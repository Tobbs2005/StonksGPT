import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PLSparkline } from '@/components/Account/PLSparkline';
import { AssetRingChart } from '@/components/Account/AssetRingChart';
import { AccountStatsPanel } from '@/components/Account/AccountStatsPanel';
import { PositionsTable } from '@/components/Account/PositionsTable';
import { PLAnalysisView } from '@/components/Account/PLAnalysisView';
import { PendingOrdersList } from '@/components/Sidebar/PendingOrdersList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { accountApi, positionsApi, portfolioApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Search, Bell, ChevronRight } from 'lucide-react';

type PrimaryTab = 'assets' | 'orders' | 'history';
type InternalView = 'assets-analysis' | 'pl-analysis';
type AssetFilter = 'securities' | 'funds' | 'bonds';

/* ── data helpers ─────────────────────────────────────────── */

function parseAccountInfo(text: string): Record<string, string> {
  const info: Record<string, string> = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/(\w+(?:\s+\w+)*):\s*(.+)/);
    if (match) {
      const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
      info[key] = match[2].trim();
    }
  }
  return info;
}

interface PositionData {
  symbol: string;
  market_value: string;
  unrealized_pl: string;
  [key: string]: string;
}

function parsePositionsForRing(text: string): PositionData[] {
  if (!text || text.includes('No open positions')) return [];
  const positions: PositionData[] = [];
  let current: Record<string, string> | null = null;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const sym = line.match(/^Symbol:\s*(.+)$/i);
    if (sym) {
      if (current?.symbol) positions.push(current as PositionData);
      current = { symbol: sym[1].trim() };
      continue;
    }
    if (!current) continue;
    const field = line.match(/^(.*?):\s*(.+)$/);
    if (!field) continue;
    const key = field[1].trim().toLowerCase();
    const val = field[2].trim();
    if (key.startsWith('market value')) current.market_value = val;
    else if (key.startsWith('unrealized p/l')) {
      const m = val.match(/(.+?)\s*\((.+)\)/);
      if (m) current.unrealized_pl = m[1].trim();
      else current.unrealized_pl = val;
    } else {
      current[key.replace(/\s+/g, '_')] = val;
    }
  }
  if (current?.symbol) positions.push(current as PositionData);
  return positions;
}

function fmtLarge(value?: string): string {
  if (!value) return '$0.00';
  const num = Number(value.replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

/* ring chart color palette from existing chart vars */
const RING_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

/* ── page component ───────────────────────────────────────── */

export function AccountPage() {
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('assets');
  const [internalView, setInternalView] = useState<InternalView>('assets-analysis');
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('securities');

  const { data: accountRaw } = useQuery({
    queryKey: ['account'],
    queryFn: () => accountApi.getAccountInfo(),
    refetchInterval: 30000,
  });

  const { data: positionsRaw } = useQuery({
    queryKey: ['positions'],
    queryFn: () => positionsApi.getAllPositions(),
    refetchInterval: 30000,
  });

  /* ── Real portfolio history for the summary sparkline (1M window) ── */
  const { data: portfolioHistory } = useQuery({
    queryKey: ['portfolio-history', '1M'],
    queryFn: () => portfolioApi.getHistory({ period: '1M', timeframe: '1D' }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const sparklineData: number[] = useMemo(() => {
    if (!portfolioHistory?.equity?.length) return [];
    // Filter out null values (weekends/holidays)
    return portfolioHistory.equity.filter((v): v is number => v != null);
  }, [portfolioHistory]);

  const accountData = useMemo(() => (accountRaw ? parseAccountInfo(accountRaw) : {}), [accountRaw]);
  const positionsForRing = useMemo(() => (positionsRaw ? parsePositionsForRing(positionsRaw) : []), [positionsRaw]);

  const equity = accountData.equity || accountData.portfolio_value || '0';

  /* Build ring chart segments from real positions */
  const ringSegments = useMemo(() => {
    return positionsForRing.map((p, i) => ({
      label: p.symbol,
      value: Math.abs(Number(p.market_value?.replace(/[^0-9.-]/g, '')) || 0),
      color: RING_COLORS[i % RING_COLORS.length],
    }));
  }, [positionsForRing]);

  const primaryTabs: { key: PrimaryTab; label: string }[] = [
    { key: 'assets', label: 'Assets' },
    { key: 'orders', label: 'Orders' },
    { key: 'history', label: 'History' },
  ];

  const assetFilters: { key: AssetFilter; label: string }[] = [
    { key: 'securities', label: 'Securities' },
    { key: 'funds', label: 'Funds' },
    { key: 'bonds', label: 'Bonds' },
  ];

  const handlePrimaryTabChange = (tab: PrimaryTab) => {
    setPrimaryTab(tab);
    if (tab !== 'assets') setInternalView('assets-analysis');
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto w-full">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Accounts</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-5 w-5 rounded bg-muted flex items-center justify-center">
                <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Paper Trading Account</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Primary tabs ───────────────────────────────────── */}
        <div className="flex items-center gap-1 mt-4 border-b border-border">
          {primaryTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handlePrimaryTabChange(tab.key)}
              className={cn(
                'px-4 pb-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                primaryTab === tab.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Internal sub-tabs (Assets Analysis / P/L Analysis) ── */}
        {primaryTab === 'assets' && (
          <div className="flex items-center gap-1 mt-3">
            <button
              onClick={() => setInternalView('assets-analysis')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                internalView === 'assets-analysis'
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              Assets Analysis
            </button>
            <button
              onClick={() => setInternalView('pl-analysis')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                internalView === 'pl-analysis'
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              P/L Analysis
            </button>
          </div>
        )}

        {/* ── Assets Analysis view ─────────────────────────────── */}
        {primaryTab === 'assets' && internalView === 'assets-analysis' && (
          <div key="assets-analysis" className="animate-in fade-in duration-200 mt-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              {/* LEFT COLUMN */}
              <div className="space-y-6">
                {/* Summary + Sparkline */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-6">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Total Assets &middot; USD
                        </p>
                        <p className="text-3xl font-semibold tabular-nums text-foreground">
                          {fmtLarge(equity)}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {sparklineData.length >= 2 ? (
                          <PLSparkline data={sparklineData} width={240} height={64} />
                        ) : (
                          <div className="flex items-center justify-center text-xs text-muted-foreground" style={{ width: 240, height: 64 }}>
                            Loading chart...
                          </div>
                        )}
                        <button
                          onClick={() => setInternalView('pl-analysis')}
                          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          P/L Analysis <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Asset filter pills */}
                <div className="inline-flex rounded-md border border-input bg-muted/40 p-1">
                  {assetFilters.map((filter) => (
                    <Button
                      key={filter.key}
                      variant={assetFilter === filter.key ? 'secondary' : 'ghost'}
                      size="sm"
                      className="rounded-sm px-4"
                      onClick={() => setAssetFilter(filter.key)}
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>

                {/* Positions table */}
                {assetFilter === 'securities' ? (
                  <PositionsTable />
                ) : (
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-sm text-muted-foreground">
                        No {assetFilter} positions to display.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* RIGHT COLUMN — stats + ring */}
              <div className="space-y-6">
                {/* Asset allocation ring */}
                {ringSegments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Asset Allocation</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4 pb-5">
                      <AssetRingChart segments={ringSegments} size={160} strokeWidth={18} />
                      <div className="w-full space-y-1.5 mt-1">
                        {ringSegments.map((seg) => (
                          <div key={seg.label} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: seg.color }}
                              />
                              <span className="text-muted-foreground truncate max-w-[120px]">{seg.label}</span>
                            </div>
                            <span className="font-medium tabular-nums text-foreground">
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                maximumFractionDigits: 0,
                              }).format(seg.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <AccountStatsPanel accountData={accountData} />
              </div>
            </div>
          </div>
        )}

        {/* ── P/L Analysis view ────────────────────────────────── */}
        {primaryTab === 'assets' && internalView === 'pl-analysis' && (
          <div key="pl-analysis" className="mt-6">
            <PLAnalysisView
              onBack={() => setInternalView('assets-analysis')}
              accountData={accountData}
            />
          </div>
        )}

        {/* ── Orders view ────────────────────────────────────── */}
        {primaryTab === 'orders' && (
          <div className="mt-6 max-w-4xl">
            <PendingOrdersList />
          </div>
        )}

        {/* ── History view (placeholder) ─────────────────────── */}
        {primaryTab === 'history' && (
          <div className="mt-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Order history will be displayed here.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
