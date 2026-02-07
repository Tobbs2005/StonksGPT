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

    const positions: Array<{
      symbol: string;
      qty: string;
      market_value: string;
      avg_entry_price: string;
      current_price: string;
      unrealized_pl: string;
      unrealized_plpc: string;
    }> = [];

    const positionBlocks = text.split('Symbol:').slice(1);

    for (const block of positionBlocks) {
      const lines = block.split('\n');
      const position: any = {};

      for (const line of lines) {
        const match = line.match(/(\w+(?:\s+\w+)*):\s*(.+)/);
        if (match) {
          const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
          position[key] = match[2].trim();
        }
      }

      if (position.symbol) {
        positions.push(position);
      }
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
                  {position.qty} @ {position.avg_entry_price}
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
