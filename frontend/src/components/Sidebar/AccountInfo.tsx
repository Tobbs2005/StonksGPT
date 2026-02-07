import { useQuery } from '@tanstack/react-query';
import { CardContent } from '@/components/ui/card';
import { accountApi } from '@/lib/api';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export function AccountInfo() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['account'],
    queryFn: () => accountApi.getAccountInfo(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </CardContent>
    );
  }

  if (error) {
    return (
      <CardContent className="pt-0">
        <p className="text-sm text-destructive">Error loading account info</p>
      </CardContent>
    );
  }

  const parseAccountInfo = (text: string) => {
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
  };

  const accountData = data ? parseAccountInfo(data) : {};

  const getValueTone = (value?: string) => {
    if (!value) return 'text-foreground';
    const numeric = Number(value.replace(/[^0-9.-]/g, ''));
    if (Number.isNaN(numeric) || numeric === 0) return 'text-foreground';
    return numeric > 0 ? 'text-emerald-500' : 'text-red-500';
  };

  return (
    <CardContent className="space-y-3 pt-0">
      {accountData.buying_power && (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Buying Power
          </p>
          <p className={cn('text-2xl font-medium', getValueTone(accountData.buying_power))}>
            {accountData.buying_power}
          </p>
        </div>
      )}

      {(accountData.cash ||
        accountData.portfolio_value ||
        accountData.equity ||
        accountData.status) && <Separator className="my-2" />}

      {accountData.cash && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Cash</span>
          <span className={cn('font-medium', getValueTone(accountData.cash))}>
            {accountData.cash}
          </span>
        </div>
      )}

      {accountData.portfolio_value && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Portfolio Value</span>
          <span className={cn('font-medium', getValueTone(accountData.portfolio_value))}>
            {accountData.portfolio_value}
          </span>
        </div>
      )}

      {accountData.equity && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Equity</span>
          <span className={cn('font-medium', getValueTone(accountData.equity))}>
            {accountData.equity}
          </span>
        </div>
      )}

      {accountData.status && (
        <>
          <Separator className="my-2" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium text-foreground">{accountData.status}</span>
          </div>
        </>
      )}
    </CardContent>
  );
}
