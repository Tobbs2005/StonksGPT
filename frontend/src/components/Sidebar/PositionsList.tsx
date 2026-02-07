import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { positionsApi } from '@/lib/api';

export function PositionsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['positions'],
    queryFn: () => positionsApi.getAllPositions(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading positions...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Error loading positions</p>
        </CardContent>
      </Card>
    );
  }

  // Parse positions from the MCP server response
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

    // Simple parsing - split by position blocks
    const positionBlocks = text.split('Symbol:').slice(1);
    
    for (const block of positionBlocks) {
      const symbolMatch = block.match(/^(\w+)/);
      const qtyMatch = block.match(/Quantity:\s*([^\n]+)/);
      const marketValueMatch = block.match(/Market Value:\s*([^\n]+)/);
      const avgEntryMatch = block.match(/Average Entry Price:\s*([^\n]+)/);
      const currentPriceMatch = block.match(/Current Price:\s*([^\n]+)/);
      const plMatch = block.match(/Unrealized P\/L:\s*([^\n]+)/);
      const plpcMatch = block.match(/\(([^)]+)\)/);

      if (symbolMatch) {
        positions.push({
          symbol: symbolMatch[1],
          qty: qtyMatch?.[1]?.trim() || '',
          market_value: marketValueMatch?.[1]?.trim() || '',
          avg_entry_price: avgEntryMatch?.[1]?.trim() || '',
          current_price: currentPriceMatch?.[1]?.trim() || '',
          unrealized_pl: plMatch?.[1]?.trim() || '',
          unrealized_plpc: plpcMatch?.[1]?.trim() || '',
        });
      }
    }

    return positions;
  };

  const positions = data ? parsePositions(data) : [];

  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No open positions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Positions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>P/L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position, index) => {
              const plValue = parseFloat(position.unrealized_pl.replace(/[^0-9.-]/g, ''));
              const isPositive = !isNaN(plValue) && plValue >= 0;
              
              return (
                <TableRow key={`${position.symbol}-${index}`}>
                  <TableCell className="font-medium">{position.symbol}</TableCell>
                  <TableCell>{position.qty}</TableCell>
                  <TableCell>{position.market_value}</TableCell>
                  <TableCell>
                    <Badge variant={isPositive ? 'default' : 'destructive'}>
                      {position.unrealized_pl}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
