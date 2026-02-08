import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { positionsApi, portfolioApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { CrossfadePLChart } from './CrossfadePLChart';
import {
  VALID_RANGES,
  DEFAULT_RANGE,
  rangeToApiParams,
  type TimeRange,
  type PLDataPoint,
} from './PLChart';

/* ── helpers ──────────────────────────────────────────────── */

interface Position {
  symbol: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  market_value: string;
  [key: string]: string;
}

function parsePositions(text: string): Position[] {
  if (!text || text.includes('No open positions')) return [];
  const positions: Position[] = [];
  let current: Record<string, string> | null = null;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const sym = line.match(/^Symbol:\s*(.+)$/i);
    if (sym) {
      if (current?.symbol) positions.push(current as Position);
      current = { symbol: sym[1].trim() };
      continue;
    }
    if (!current) continue;
    const field = line.match(/^(.*?):\s*(.+)$/);
    if (!field) continue;
    const key = field[1].trim().toLowerCase();
    const val = field[2].trim();
    if (key.startsWith('quantity')) current.qty = val;
    else if (key.startsWith('market value')) current.market_value = val;
    else if (key.startsWith('unrealized p/l')) {
      const m = val.match(/(.+?)\s*\((.+)\)/);
      if (m) { current.unrealized_pl = m[1].trim(); current.unrealized_plpc = m[2].trim(); }
      else { current.unrealized_pl = val; current.unrealized_plpc = ''; }
    } else {
      current[key.replace(/\s+/g, '_')] = val;
    }
  }
  if (current?.symbol) positions.push(current as Position);
  return positions;
}

function numVal(value?: string): number {
  if (!value) return 0;
  return Number(value.replace(/[^0-9.-]/g, '')) || 0;
}

function fmtCurrency(value?: string): string {
  if (!value) return '$0.00';
  const n = numVal(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function plTone(value?: string): string {
  const n = numVal(value);
  if (n === 0) return 'text-muted-foreground';
  return n > 0 ? 'text-emerald-500' : 'text-red-500';
}

/* ── portfolio history → chart data helper ────────────────── */

function buildApiParams(range: TimeRange): {
  period?: string;
  timeframe?: string;
  start?: string;
} {
  const { period, timeframe } = rangeToApiParams(range);
  if (range === 'YTD') {
    const jan1 = `${new Date().getFullYear()}-01-01`;
    return { start: jan1, timeframe };
  }
  return { period, timeframe };
}

/* ── component ────────────────────────────────────────────── */

type RankMode = 'winners' | 'losers';

interface PLAnalysisViewProps {
  onBack: () => void;
  accountData: Record<string, string>;
}

export function PLAnalysisView({ onBack, accountData }: PLAnalysisViewProps) {
  const [rankMode, setRankMode] = useState<RankMode>('winners');

  /* ── URL-synced range state ─────────────────────────────── */
  const [searchParams, setSearchParams] = useSearchParams();
  const urlRange = searchParams.get('range') as TimeRange | null;
  const range: TimeRange =
    urlRange && (VALID_RANGES as readonly string[]).includes(urlRange)
      ? urlRange
      : DEFAULT_RANGE;

  const handleRangeChange = (next: TimeRange) => {
    if (next === range) return;
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('range', next);
        return p;
      },
      { replace: false },
    );
  };

  /* ── portfolio history (real Alpaca data) ────────────────── */
  const apiParams = buildApiParams(range);
  const { data: portfolioHistory, isLoading: chartLoading } = useQuery({
    queryKey: ['portfolio-history', range],
    queryFn: () => portfolioApi.getHistory(apiParams),
    staleTime: 60_000, // cache 1 min to avoid hammering on range switches
    refetchInterval: 60_000,
  });

  const chartData: PLDataPoint[] = useMemo(() => {
    if (!portfolioHistory?.timestamp?.length || !portfolioHistory?.equity?.length) return [];
    const { timestamp, equity } = portfolioHistory;
    const len = Math.min(timestamp.length, equity.length);
    const points: PLDataPoint[] = [];
    for (let i = 0; i < len; i++) {
      // Skip null equity points (weekends / holidays)
      if (equity[i] == null) continue;
      points.push({ time: timestamp[i], value: equity[i] });
    }
    return points;
  }, [portfolioHistory]);

  /* ── positions data ─────────────────────────────────────── */
  const { data: positionsRaw } = useQuery({
    queryKey: ['positions'],
    queryFn: () => positionsApi.getAllPositions(),
    refetchInterval: 30000,
  });

  const positions = useMemo(() => (positionsRaw ? parsePositions(positionsRaw) : []), [positionsRaw]);

  const stats = useMemo(() => {
    let totalPL = 0;
    let profit = 0;
    let loss = 0;
    let winCount = 0;

    for (const p of positions) {
      const pl = numVal(p.unrealized_pl);
      totalPL += pl;
      if (pl > 0) { profit += pl; winCount++; }
      else if (pl < 0) { loss += Math.abs(pl); }
    }

    const winRate = positions.length > 0 ? (winCount / positions.length) * 100 : 0;
    return { totalPL, profit, loss, winRate };
  }, [positions]);

  const ranked = useMemo(() => {
    const sorted = [...positions].sort((a, b) => numVal(b.unrealized_pl) - numVal(a.unrealized_pl));
    const winners = sorted.filter((p) => numVal(p.unrealized_pl) > 0);
    const losers = sorted.filter((p) => numVal(p.unrealized_pl) < 0).reverse();
    return { winners, losers };
  }, [positions]);

  const activeList = rankMode === 'winners' ? ranked.winners : ranked.losers;

  const fmtSigned = (n: number) => {
    const prefix = n >= 0 ? '+' : '';
    return prefix + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  };

  /* ── Hero P/L always shows current unrealized P/L from positions ── */
  const heroPL = stats.totalPL;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* ── Top bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold text-foreground">P/L Analysis</h3>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* LEFT */}
        <div className="space-y-6">
          {/* Hero P/L summary */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Total Unrealized P/L
                  </p>
                  <p className={cn('text-3xl font-semibold tabular-nums', heroPL >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                    {fmtSigned(heroPL)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {chartLoading
                      ? 'Loading portfolio history...'
                      : `${chartData.length} data points · ${positions.length} open position${positions.length !== 1 ? 's' : ''}`}
                  </p>
                </div>

                {/* ── Range selector ───────────────────────────── */}
                <div
                  className="inline-flex rounded-md border border-input bg-muted/40 p-0.5 shrink-0"
                  role="group"
                  aria-label="Time range"
                >
                  {VALID_RANGES.map((r) => (
                    <button
                      key={r}
                      onClick={() => handleRangeChange(r)}
                      aria-pressed={r === range}
                      className={cn(
                        'px-2.5 py-1 text-xs font-medium rounded-sm transition-colors duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                        r === range
                          ? 'bg-secondary text-secondary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Crossfade chart (real Alpaca data) ─────────── */}
              <CrossfadePLChart data={chartData} range={range} height={280} />

              <Separator />

              {/* Metric grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Unrealized Profit</p>
                  <p className="text-sm font-medium tabular-nums text-emerald-500">{fmtSigned(stats.profit)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Unrealized Loss</p>
                  <p className="text-sm font-medium tabular-nums text-red-500">{fmtSigned(-stats.loss)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                  <p className="text-sm font-medium tabular-nums text-foreground">{stats.winRate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rankings */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-foreground">P/L Rankings</p>
                <button className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  All <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              <div className="inline-flex rounded-md border border-input bg-muted/40 p-1 mb-4">
                <Button
                  variant={rankMode === 'winners' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-sm px-4"
                  onClick={() => setRankMode('winners')}
                >
                  Top Winners
                </Button>
                <Button
                  variant={rankMode === 'losers' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-sm px-4"
                  onClick={() => setRankMode('losers')}
                >
                  Top Losers
                </Button>
              </div>

              {activeList.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No {rankMode === 'winners' ? 'winning' : 'losing'} positions.
                </p>
              ) : (
                <div className="space-y-0">
                  {activeList.map((position, idx) => (
                    <div key={position.symbol}>
                      <div className="flex items-center justify-between py-3 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="h-6 w-6 p-0 flex items-center justify-center text-[10px] tabular-nums shrink-0">
                            {idx + 1}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">{position.symbol}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn('text-sm font-medium tabular-nums', plTone(position.unrealized_pl))}>
                            {fmtCurrency(position.unrealized_pl)}
                          </p>
                          {position.unrealized_plpc && (
                            <p className={cn('text-xs tabular-nums', plTone(position.unrealized_plpc))}>
                              {position.unrealized_plpc}
                            </p>
                          )}
                        </div>
                      </div>
                      {idx < activeList.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — stats sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-0">
              <p className="text-sm font-semibold text-foreground mb-3">P/L Breakdown</p>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Winning positions</span>
                <span className="text-sm font-medium tabular-nums text-emerald-500">{ranked.winners.length}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Losing positions</span>
                <span className="text-sm font-medium tabular-nums text-red-500">{ranked.losers.length}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Net Assets</span>
                <span className="text-sm font-medium tabular-nums">
                  {fmtCurrency(accountData.equity || accountData.portfolio_value)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Cash</span>
                <span className="text-sm font-medium tabular-nums">{fmtCurrency(accountData.cash)}</span>
              </div>
              {portfolioHistory?.base_value != null && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Base Value</span>
                    <span className="text-sm font-medium tabular-nums">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(portfolioHistory.base_value)}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
