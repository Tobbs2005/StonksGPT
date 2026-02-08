import { useQuery } from '@tanstack/react-query';
import { positionsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
  if (!text || text.includes('No open positions')) {
    return [];
  }

  const positions: Position[] = [];
  let current: Record<string, string> | null = null;

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const symbolMatch = line.match(/^Symbol:\s*(.+)$/i);
    if (symbolMatch) {
      if (current?.symbol) {
        positions.push(current as Position);
      }
      current = { symbol: symbolMatch[1].trim() };
      continue;
    }

    if (!current) continue;

    const fieldMatch = line.match(/^(.*?):\s*(.+)$/);
    if (!fieldMatch) continue;

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
        current.unrealized_plpc = '';
      }
    } else {
      current[rawKey.replace(/\s+/g, '_')] = value;
    }
  }

  if (current?.symbol) {
    positions.push(current as Position);
  }

  return positions;
}

function fmtCurrency(value?: string): string {
  if (!value) return '—';
  const num = Number(value.replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

function plTone(value?: string): string {
  if (!value) return 'text-muted-foreground';
  const num = Number(value.replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(num) || num === 0) return 'text-muted-foreground';
  return num > 0 ? 'text-emerald-500' : 'text-red-500';
}

export function PositionsTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['positions'],
    queryFn: () => positionsApi.getAllPositions(),
    refetchInterval: 30000,
  });

  const positions = data ? parsePositions(data) : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            Positions{positions.length > 0 ? ` (${positions.length})` : ''}
          </CardTitle>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            Trade
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground px-6 pb-6">Loading positions...</p>
        ) : error ? (
          <p className="text-sm text-destructive px-6 pb-6">Error loading positions</p>
        ) : positions.length === 0 ? (
          <p className="text-sm text-muted-foreground px-6 pb-6">No open positions</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Symbol</TableHead>
                <TableHead className="text-right">MV / Qty</TableHead>
                <TableHead className="text-right">Price / Cost</TableHead>
                <TableHead className="text-right pr-6">P/L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position, idx) => (
                <TableRow key={`${position.symbol}-${idx}`}>
                  <TableCell className="pl-6">
                    <div>
                      <p className="text-sm font-medium truncate max-w-[160px]">{position.symbol}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>
                      <p className="text-sm font-medium tabular-nums">{fmtCurrency(position.market_value)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{position.qty} shares</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>
                      <p className="text-sm font-medium tabular-nums">{fmtCurrency(position.current_price)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{fmtCurrency(position.avg_entry_price)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div>
                      <p className={cn('text-sm font-medium tabular-nums', plTone(position.unrealized_pl))}>
                        {fmtCurrency(position.unrealized_pl)}
                      </p>
                      {position.unrealized_plpc && (
                        <p className={cn('text-xs tabular-nums', plTone(position.unrealized_plpc))}>
                          {position.unrealized_plpc}
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
