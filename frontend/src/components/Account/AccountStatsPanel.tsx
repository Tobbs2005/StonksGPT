import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface AccountStatsPanelProps {
  accountData: Record<string, string>;
}

function fmt(value?: string): string {
  if (!value) return '—';
  const num = Number(value.replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

function tone(value?: string): string {
  if (!value) return 'text-foreground';
  const num = Number(value.replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(num) || num === 0) return 'text-foreground';
  return num > 0 ? 'text-emerald-500' : 'text-red-500';
}

interface RowProps {
  label: string;
  value?: string;
  colored?: boolean;
}

function StatRow({ label, value, colored }: RowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-medium tabular-nums', colored ? tone(value) : 'text-foreground')}>
        {fmt(value)}
      </span>
    </div>
  );
}

export function AccountStatsPanel({ accountData }: AccountStatsPanelProps) {
  const equity = accountData.equity || accountData.portfolio_value;
  const marketValue = accountData.long_market_value || accountData.portfolio_value;
  const cash = accountData.cash;
  const buyingPower = accountData.buying_power;
  const status = accountData.status;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Account Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        <StatRow label="Net Assets" value={equity} />
        <Separator />
        <StatRow label="Market Value" value={marketValue} />
        <Separator />
        <StatRow label="Total Cash" value={cash} />
        <Separator />
        <StatRow label="Buying Power" value={buyingPower} />
        <Separator />

        {/* Risk status */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">Risk Status</span>
          {status ? (
            <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
              {status === 'ACTIVE' ? 'Safe' : status}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
