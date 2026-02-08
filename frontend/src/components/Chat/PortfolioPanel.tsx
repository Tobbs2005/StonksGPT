import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { accountApi, positionsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ChevronRight, TrendingUp, TrendingDown, Wallet, DollarSign, BarChart3 } from 'lucide-react';

/* ── parsing helpers (shared with AccountPage) ─────────────── */

function parseAccountInfo(text: string): Record<string, string> {
  const info: Record<string, string> = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/(\w+(?:\s+\w+)*):\s*(.+)/);
    if (match) {
      info[match[1].trim().toLowerCase().replace(/\s+/g, '_')] = match[2].trim();
    }
  }
  return info;
}

interface Position {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
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
    const rawKey = field[1].trim().toLowerCase();
    const value = field[2].trim();
    if (rawKey.startsWith('quantity')) current.qty = value.replace(/\s*shares?$/i, '').trim();
    else if (rawKey.startsWith('average entry price')) current.avg_entry_price = value;
    else if (rawKey.startsWith('current price')) current.current_price = value;
    else if (rawKey.startsWith('market value')) current.market_value = value;
    else if (rawKey.startsWith('unrealized p/l')) {
      const m = value.match(/(.+?)\s*\((.+)\)/);
      if (m) { current.unrealized_pl = m[1].trim(); current.unrealized_plpc = m[2].trim(); }
      else { current.unrealized_pl = value; current.unrealized_plpc = ''; }
    } else {
      current[rawKey.replace(/\s+/g, '_')] = value;
    }
  }
  if (current?.symbol) positions.push(current as Position);
  return positions;
}

/* ── formatting helpers ────────────────────────────────────── */

function fmtCurrency(value?: string): string {
  if (!value) return '—';
  const num = Number(value.replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

function toNum(value?: string): number {
  if (!value) return 0;
  const num = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isNaN(num) ? 0 : num;
}

function plColor(value?: string): string {
  const num = toNum(value);
  if (num > 0) return 'text-emerald-500';
  if (num < 0) return 'text-red-500';
  return 'text-muted-foreground';
}

/* ── skeleton ──────────────────────────────────────────────── */

function SkeletonBar({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted/60', className)} />;
}

function PanelSkeleton() {
  return (
    <div className="space-y-5 p-4">
      <div className="space-y-2">
        <SkeletonBar className="h-3 w-24" />
        <SkeletonBar className="h-7 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><SkeletonBar className="h-3 w-16" /><SkeletonBar className="h-5 w-20" /></div>
        <div className="space-y-2"><SkeletonBar className="h-3 w-16" /><SkeletonBar className="h-5 w-20" /></div>
      </div>
      <SkeletonBar className="h-px w-full" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="space-y-1.5"><SkeletonBar className="h-4 w-14" /><SkeletonBar className="h-3 w-20" /></div>
          <div className="space-y-1.5 flex flex-col items-end"><SkeletonBar className="h-4 w-16" /><SkeletonBar className="h-3 w-12" /></div>
        </div>
      ))}
    </div>
  );
}

/* ── main component ────────────────────────────────────────── */

const PortfolioPanel = React.memo(function PortfolioPanel() {
  const navigate = useNavigate();

  const { data: accountRaw, isLoading: accLoading } = useQuery({
    queryKey: ['account'],
    queryFn: () => accountApi.getAccountInfo(),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: positionsRaw, isLoading: posLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: () => positionsApi.getAllPositions(),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const accountData = useMemo(() => (accountRaw ? parseAccountInfo(accountRaw) : {}), [accountRaw]);
  const positions = useMemo(() => (positionsRaw ? parsePositions(positionsRaw) : []), [positionsRaw]);

  const isLoading = accLoading || posLoading;

  const equity = accountData.equity || accountData.portfolio_value;
  const cash = accountData.cash;
  const buyingPower = accountData.buying_power;
  const longMv = accountData.long_market_value;

  // Compute total unrealized P/L from positions
  const totalPL = useMemo(() => {
    return positions.reduce((sum, p) => sum + toNum(p.unrealized_pl), 0);
  }, [positions]);

  const totalPLPct = useMemo(() => {
    const eq = toNum(equity);
    if (eq <= 0 || totalPL === 0) return 0;
    return (totalPL / (eq - totalPL)) * 100;
  }, [totalPL, equity]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-border/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portfolio</p>
        </div>
        <PanelSkeleton />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header ───────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-border/40 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portfolio</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* ── Total value hero ──────────────────────────── */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Net Assets</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground tracking-tight">
              {fmtCurrency(equity)}
            </p>
          </div>

          {/* ── P/L + Cash row ────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Today's P/L */}
            <div className="rounded-lg bg-muted/30 border border-border/30 px-3 py-2.5 space-y-1">
              <div className="flex items-center gap-1">
                {totalPL >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Unrealized P/L
                </span>
              </div>
              <p className={cn('text-sm font-semibold tabular-nums', totalPL >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                {totalPL >= 0 ? '+' : ''}{fmtCurrency(totalPL.toFixed(2))}
              </p>
              <p className={cn('text-[10px] tabular-nums', totalPL >= 0 ? 'text-emerald-500/70' : 'text-red-500/70')}>
                {totalPLPct >= 0 ? '+' : ''}{totalPLPct.toFixed(2)}%
              </p>
            </div>

            {/* Cash available */}
            <div className="rounded-lg bg-muted/30 border border-border/30 px-3 py-2.5 space-y-1">
              <div className="flex items-center gap-1">
                <Wallet className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Cash</span>
              </div>
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {fmtCurrency(cash)}
              </p>
              <div className="flex items-center gap-1">
                <DollarSign className="h-2.5 w-2.5 text-muted-foreground/60" />
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  BP: {fmtCurrency(buyingPower)}
                </p>
              </div>
            </div>
          </div>

          {/* ── Market value stat ─────────────────────────── */}
          {longMv && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Market Value</span>
              <span className="font-medium tabular-nums text-foreground">{fmtCurrency(longMv)}</span>
            </div>
          )}

          <Separator className="opacity-50" />

          {/* ── Holdings list ─────────────────────────────── */}
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              Holdings{positions.length > 0 ? ` (${positions.length})` : ''}
            </p>

            {positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-xs text-muted-foreground">No open positions</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Positions will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {positions.map((pos, idx) => (
                  <div
                    key={`${pos.symbol}-${idx}`}
                    className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-muted/30 transition-colors duration-150"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{pos.symbol}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {pos.qty} @ {fmtCurrency(pos.avg_entry_price)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium tabular-nums text-foreground">
                        {fmtCurrency(pos.market_value)}
                      </p>
                      <p className={cn('text-[11px] font-medium tabular-nums', plColor(pos.unrealized_pl))}>
                        {toNum(pos.unrealized_pl) > 0 ? '+' : ''}{fmtCurrency(pos.unrealized_pl)}
                        {pos.unrealized_plpc && (
                          <span className="ml-1 opacity-70">({pos.unrealized_plpc})</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator className="opacity-50" />

          {/* ── View full portfolio link ──────────────────── */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-xs text-muted-foreground hover:text-foreground h-8"
            onClick={() => navigate('/account')}
          >
            View full portfolio
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
});

export { PortfolioPanel };
