import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { accountApi } from '@/lib/api';
import { Separator } from '@/components/ui/separator';

export function AccountInfo() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['account'],
    queryFn: () => accountApi.getAccountInfo(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Error loading account info</p>
        </CardContent>
      </Card>
    );
  }

  // Parse the account info string (format from MCP server)
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {accountData.buying_power && (
          <div>
            <div className="text-sm text-muted-foreground">Buying Power</div>
            <div className="text-lg font-semibold">{accountData.buying_power}</div>
          </div>
        )}
        <Separator />
        {accountData.cash && (
          <div>
            <div className="text-sm text-muted-foreground">Cash</div>
            <div className="text-lg font-semibold">{accountData.cash}</div>
          </div>
        )}
        <Separator />
        {accountData.portfolio_value && (
          <div>
            <div className="text-sm text-muted-foreground">Portfolio Value</div>
            <div className="text-lg font-semibold">{accountData.portfolio_value}</div>
          </div>
        )}
        <Separator />
        {accountData.equity && (
          <div>
            <div className="text-sm text-muted-foreground">Equity</div>
            <div className="text-lg font-semibold">{accountData.equity}</div>
          </div>
        )}
        {accountData.status && (
          <>
            <Separator />
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="text-sm font-medium">{accountData.status}</div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
