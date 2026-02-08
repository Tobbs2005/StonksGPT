import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X } from 'lucide-react';

/* ── types & parsing ─────────────────────────────────────── */

interface ParsedOrder {
  symbol: string;
  id?: string;
  side?: string;
  quantity?: string;
  type?: string;
  status?: string;
  time_in_force?: string;
  limit_price?: string;
  [key: string]: string | undefined;
}

function parseOrders(text: string): ParsedOrder[] {
  if (!text || text.toLowerCase().includes('no open orders')) return [];
  const orders: ParsedOrder[] = [];
  let current: Record<string, string> | null = null;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const sym = line.match(/^Symbol:\s*(.+)$/i);
    if (sym) {
      if (current?.symbol) orders.push(current as ParsedOrder);
      current = { symbol: sym[1].trim() };
      continue;
    }
    if (!current) continue;
    const field = line.match(/^(.*?):\s*(.+)$/);
    if (!field) continue;
    current[field[1].trim().toLowerCase().replace(/\s+/g, '_')] = field[2].trim();
  }
  if (current?.symbol) orders.push(current as ParsedOrder);
  return orders;
}

/* ── helpers ──────────────────────────────────────────────── */

function sideLabel(value?: string): string {
  if (!value) return '';
  return value.toUpperCase();
}

function typeLabel(value?: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function tifLabel(value?: string): string {
  if (!value) return '';
  return value.toUpperCase();
}

/* ── component ────────────────────────────────────────────── */

export function PendingOrdersList() {
  const [cancelingIds, setCancelingIds] = useState<Set<string>>(new Set());
  const [confirmCancelAll, setConfirmCancelAll] = useState(false);
  const [cancelingAll, setCancelingAll] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', 'open'],
    queryFn: () => ordersApi.getOrders({ status: 'open', limit: 10 }),
    refetchInterval: 30000,
  });

  const orders = data ? parseOrders(data) : [];

  /* ── actions ─────────────────────────────────────────── */

  const handleCancel = async (orderId?: string) => {
    if (!orderId) return;
    setCancelingIds((prev) => new Set(prev).add(orderId));
    try {
      await ordersApi.cancelOrder(orderId);
      await queryClient.invalidateQueries({ queryKey: ['orders', 'open'] });
    } catch (err) {
      console.error('Failed to cancel order', err);
    } finally {
      setCancelingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleCancelAll = async () => {
    const ids = orders.map((o) => o.id).filter(Boolean) as string[];
    if (ids.length === 0) return;
    setCancelingAll(true);
    try {
      await Promise.allSettled(ids.map((id) => ordersApi.cancelOrder(id)));
      await queryClient.invalidateQueries({ queryKey: ['orders', 'open'] });
    } catch (err) {
      console.error('Failed to cancel all orders', err);
    } finally {
      setCancelingAll(false);
      setConfirmCancelAll(false);
    }
  };

  /* ── loading / error / empty states ──────────────────── */

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-2">Loading orders...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive py-2">Error loading orders</p>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">No open orders</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          New orders will appear here automatically
        </p>
      </div>
    );
  }

  /* ── render ──────────────────────────────────────────── */

  return (
    <div className="space-y-3">
      {/* ── Header row ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </span>
        </div>

        {orders.length > 1 && (
          <>
            {confirmCancelAll ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Cancel all?</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleCancelAll}
                  disabled={cancelingAll}
                >
                  {cancelingAll ? 'Canceling...' : 'Yes'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setConfirmCancelAll(false)}
                  disabled={cancelingAll}
                >
                  No
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmCancelAll(true)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors duration-150"
              >
                Cancel all
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Order rows ──────────────────────────────────── */}
      <div className="rounded-md border border-border overflow-hidden">
        {orders.map((order, idx) => {
          const isBuy = order.side?.toLowerCase() === 'buy';
          const isCanceling = order.id ? cancelingIds.has(order.id) : false;

          return (
            <div key={`${order.symbol}-${order.id || idx}`}>
              {idx > 0 && <Separator />}
              <div
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition-all duration-150',
                  'hover:bg-muted/50 hover:-translate-y-[0.5px]',
                  isCanceling && 'opacity-50',
                )}
              >
                {/* ── Left: Ticker + side badge ────────────── */}
                <div className="flex items-center gap-2.5 min-w-0 shrink-0">
                  <span className="text-sm font-semibold text-foreground">
                    {order.symbol}
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[10px] leading-none px-1.5 py-0.5 font-semibold',
                      isBuy
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-500 border-red-500/20',
                    )}
                  >
                    {sideLabel(order.side)}
                  </Badge>
                </div>

                {/* ── Middle: Order details chips ──────────── */}
                <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                  {/* Quantity */}
                  <span className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {order.quantity || order.qty} qty
                  </span>
                  {/* Type */}
                  {order.type && (
                    <span className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {typeLabel(order.type)}
                    </span>
                  )}
                  {/* Limit price */}
                  {order.limit_price && (
                    <span className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                      @ {order.limit_price}
                    </span>
                  )}
                  {/* Time in force */}
                  {order.time_in_force && (
                    <span className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {tifLabel(order.time_in_force)}
                    </span>
                  )}
                </div>

                {/* ── Right: Status pill + cancel ──────────── */}
                <div className="flex items-center gap-2.5 shrink-0">
                  {/* Status pill with optional pulsing dot */}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2 py-0.5">
                    <span className="relative flex h-1.5 w-1.5">
                      {/* Pulse ring (CSS animation) */}
                      <span className="absolute inset-0 rounded-full bg-amber-400/60 animate-ping" style={{ animationDuration: '2s' }} />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Pending
                    </span>
                  </span>

                  {/* Cancel button — subtle by default, danger on hover */}
                  {order.id && (
                    <button
                      onClick={() => handleCancel(order.id)}
                      disabled={isCanceling}
                      aria-label={`Cancel order for ${order.symbol}`}
                      className={cn(
                        'inline-flex items-center justify-center rounded-md h-7 w-7',
                        'border border-transparent text-muted-foreground/60',
                        'transition-all duration-150',
                        'hover:border-destructive/40 hover:text-destructive hover:bg-destructive/5',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                        'disabled:pointer-events-none disabled:opacity-40',
                      )}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
