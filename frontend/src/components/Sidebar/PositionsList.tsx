import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { positionsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

export function PositionsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['positions'],
    queryFn: () => positionsApi.getAllPositions(),
    refetchInterval: 30000,
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
        <p className="text-sm text-destructive">Error loading positions</p>
      </CardContent>
    );
  }

  const parsePositions = (text: string) => {
    if (!text || text.includes('No open positions')) {
      return [];
    }

    const positions: Array<Record<string, string>> = [];
    let current: Record<string, string> | null = null;

    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const symbolMatch = line.match(/^Symbol:\s*(.+)$/i);
      if (symbolMatch) {
        if (current?.symbol) {
          positions.push(current);
        }
        current = { symbol: symbolMatch[1].trim() };
        continue;
      }

      if (!current) {
        continue;
      }

      const fieldMatch = line.match(/^(.*?):\s*(.+)$/);
      if (!fieldMatch) {
        continue;
      }

      const rawKey = fieldMatch[1].trim().toLowerCase();
      const value = fieldMatch[2].trim();

      if (rawKey.startsWith('quantity')) {
        current.qty = value;
      } else if (rawKey.startsWith('average entry price')) {
        current.avg_entry_price = value;
      } else if (rawKey.startsWith('current price')) {
        current.current_price = value;
      } else if (rawKey.startsWith('market value')) {
        current.market_value = value;
      } else if (rawKey.startsWith('unrealized p/l')) {
        const plMatch = value.match(/(.+?)\s*\((.+)\)/);
        if (plMatch) {
          current.unrealized_pl = plMatch[1].trim();
          current.unrealized_plpc = plMatch[2].trim();
        } else {
          current.unrealized_pl = value;
        }
      } else {
        const key = rawKey.replace(/\s+/g, '_');
        current[key] = value;
      }
    }

    if (current?.symbol) {
      positions.push(current);
    }

    return positions;
  };

  const positions = data ? parsePositions(data) : [];

  if (positions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No open positions</p>
    );
  }

  const getChangeTone = (value?: string) => {
    if (!value) return 'text-muted-foreground';
    const numeric = Number(value.replace(/[^0-9.-]/g, ''));
    if (Number.isNaN(numeric) || numeric === 0) return 'text-muted-foreground';
    return numeric > 0 ? 'text-emerald-500' : 'text-red-500';
  };

  return (
    <div className="space-y-2">
      {positions.map((position, idx) => (
        <Card
          key={`${position.symbol}-${idx}`}
          className="border-sidebar-border bg-sidebar/30 shadow-none"
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              {/* Left: Symbol & Quantity */}
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-semibold text-sidebar-foreground">
                  {position.symbol}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {position.qty || position.quantity} @ {position.avg_entry_price || position.average_entry_price}
                </p>
              </div>

              {/* Right: Value & Change */}
              <div className="text-right space-y-1 shrink-0">
                <p className="text-sm font-medium text-sidebar-foreground">
                  {position.market_value || position.current_price}
                </p>
                {position.unrealized_plpc && (
                  <p
                    className={cn(
                      'text-xs font-semibold',
                      getChangeTone(position.unrealized_plpc)
                    )}
                  >
                    {position.unrealized_pl} · {position.unrealized_plpc}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
