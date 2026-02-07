import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { ordersApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function PendingOrdersList() {
  const [cancelingIds, setCancelingIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', 'open'],
    queryFn: () => ordersApi.getOrders({ status: 'open', limit: 10 }),
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
        <p className="text-sm text-destructive">Error loading orders</p>
      </CardContent>
    );
  }

  const parseOrders = (text: string) => {
    if (!text || text.toLowerCase().includes('no open orders')) {
      return [];
    }

    const orders: Array<Record<string, string>> = [];
    let current: Record<string, string> | null = null;

    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const symbolMatch = line.match(/^Symbol:\s*(.+)$/i);
      if (symbolMatch) {
        if (current?.symbol) {
          orders.push(current);
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
      const key = rawKey.replace(/\s+/g, '_');
      current[key] = value;
    }

    if (current?.symbol) {
      orders.push(current);
    }

    return orders;
  };

  const orders = data ? parseOrders(data) : [];

  if (orders.length === 0) {
    return <p className="text-sm text-muted-foreground">No open orders</p>;
  }

  const formatSide = (value?: string) => {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  };

  const formatStatus = (value?: string) => {
    if (!value) return '';
    if (value.toLowerCase() === 'accepted') {
      return 'Order Pending';
    }
    return value;
  };

  const handleCancel = async (orderId?: string) => {
    if (!orderId) {
      return;
    }
    setCancelingIds((prev) => new Set(prev).add(orderId));
    try {
      await ordersApi.cancelOrder(orderId);
      await queryClient.invalidateQueries({ queryKey: ['orders', 'open'] });
    } catch (cancelError) {
      console.error('Failed to cancel order', cancelError);
    } finally {
      setCancelingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-2">
      {orders.map((order, idx) => (
        <Card
          key={`${order.symbol}-${order.id || idx}`}
          className="border-sidebar-border bg-sidebar/30 shadow-none"
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-semibold text-sidebar-foreground">
                  {order.symbol}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {formatSide(order.side)} {order.quantity || order.qty} · {order.type}
                </p>
              </div>
              <div className="text-right space-y-1 shrink-0">
                <p className="text-xs font-medium text-sidebar-foreground">
                  {formatStatus(order.status)}
                </p>
                {order.limit_price && (
                  <p className={cn('text-xs text-muted-foreground')}>
                    Limit {order.limit_price}
                  </p>
                )}
              </div>
            </div>
            {order.id && (
              <div className="mt-2 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancel(order.id)}
                  disabled={cancelingIds.has(order.id)}
                  className="h-7 px-2 text-xs"
                >
                  {cancelingIds.has(order.id) ? 'Canceling...' : 'Cancel'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
