import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi, positionsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, Loader2 } from 'lucide-react';

/* ── types & parsing ─────────────────────────────────────── */

interface ParsedOrder {
  symbol: string;
  id?: string;
  side?: string;
  quantity?: string;
  qty?: string;
  type?: string;
  status?: string;
  time_in_force?: string;
  limit_price?: string;
  filled_price?: string;
  stop_price?: string;
  [key: string]: string | undefined;
}

function parseOrders(text: string): ParsedOrder[] {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  if (lower.includes('no open orders') || lower.includes('no orders found')) return [];

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
    const key = field[1].trim().toLowerCase().replace(/\s+/g, '_');
    const value = field[2].trim();
    current[key] = value;
    if (key === 'quantity' && !current.qty) current.qty = value.replace(/\s*shares?$/i, '').trim();
  }
  if (current?.symbol) orders.push(current as ParsedOrder);
  return orders;
}

/**
 * Get the best available price from the ORDER itself.
 * Returns undefined for market orders (they have no price field from Alpaca).
 */
function getOrderPrice(order: ParsedOrder): string | undefined {
  return order.limit_price ?? order.filled_price ?? order.stop_price;
}

/** Check if this is a market-type order */
function isMarketOrder(order: ParsedOrder): boolean {
  return order.type?.toLowerCase() === 'market';
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

const QUERY_KEY = ['orders', 'open'] as const;

/* ── Position data: avg entry price + current price per symbol ── */

interface PositionPrices {
  avg_entry_price?: string;
  current_price?: string;
}

/**
 * Parse positions text into symbol → { avg_entry_price, current_price } map.
 * The Alpaca MCP `get_all_positions` returns indented text like:
 *   Symbol: AAPL
 *   Quantity: 1 shares
 *   Market Value: $278.12
 *   Average Entry Price: $273.00
 *   Current Price: $278.12
 *   Unrealized P/L: $5.12 (1.88%)
 */
function parsePositionPrices(text: string): Map<string, PositionPrices> {
  const map = new Map<string, PositionPrices>();
  if (!text || typeof text !== 'string' || text.includes('No open positions')) return map;

  let currentSymbol: string | null = null;
  let currentPrices: PositionPrices = {};
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const sym = line.match(/^Symbol:\s*(.+)$/i);
    if (sym) {
      // Save previous
      if (currentSymbol && (currentPrices.avg_entry_price || currentPrices.current_price)) {
        map.set(currentSymbol, currentPrices);
      }
      currentSymbol = sym[1].trim();
      currentPrices = {};
      continue;
    }
    if (!currentSymbol) continue;

    const avgMatch = line.match(/^Average Entry Price:\s*(.+)$/i);
    if (avgMatch) {
      currentPrices.avg_entry_price = avgMatch[1].trim();
      continue;
    }
    const curMatch = line.match(/^Current Price:\s*(.+)$/i);
    if (curMatch) {
      currentPrices.current_price = curMatch[1].trim();
    }
  }
  // Save last
  if (currentSymbol && (currentPrices.avg_entry_price || currentPrices.current_price)) {
    map.set(currentSymbol, currentPrices);
  }
  return map;
}

/* ── component ────────────────────────────────────────────── */

export function PendingOrdersList() {
  const [cancelingIds, setCancelingIds] = useState<Set<string>>(new Set());
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());
  const [confirmCancelAll, setConfirmCancelAll] = useState(false);
  const [cancelingAll, setCancelingAll] = useState(false);
  const [cancelAllError, setCancelAllError] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => ordersApi.getOrders({ status: 'open', limit: 10 }),
    refetchInterval: 30000,
  });

  const { data: positionsData } = useQuery({
    queryKey: ['positions'],
    queryFn: () => positionsApi.getAllPositions(),
    refetchInterval: 30000,
  });

  const orders = data && typeof data === 'string' ? parseOrders(data) : [];
  const positionsBySymbol = useMemo(
    () => (positionsData && typeof positionsData === 'string' ? parsePositionPrices(positionsData) : new Map<string, PositionPrices>()),
    [positionsData],
  );

  // Clean up cancelingIds once the backend confirms orders are gone.
  useEffect(() => {
    if (cancelingIds.size === 0) return;
    const currentIds = new Set(orders.map((o) => o.id).filter(Boolean));
    const stale = [...cancelingIds].filter((id) => !currentIds.has(id));
    if (stale.length > 0) {
      setCancelingIds((prev) => {
        const next = new Set(prev);
        stale.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [orders, cancelingIds]);

  /* ── actions ─────────────────────────────────────────── */

  const handleCancel = async (orderId?: string) => {
    if (!orderId) return;

    setErrorIds((prev) => {
      if (!prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });

    setCancelingIds((prev) => new Set(prev).add(orderId));

    try {
      await ordersApi.cancelOrder(orderId);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (err) {
      console.error('Failed to cancel order', err);
      setCancelingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
      setErrorIds((prev) => new Set(prev).add(orderId));
      setTimeout(() => {
        setErrorIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }, 4000);
    }
  };

  const handleCancelAll = async () => {
    const ids = orders.map((o) => o.id).filter(Boolean) as string[];
    if (ids.length === 0) return;

    setCancelingAll(true);
    setCancelAllError(false);
    setCancelingIds(new Set(ids));

    try {
      const results = await Promise.allSettled(ids.map((id) => ordersApi.cancelOrder(id)));
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        console.error(`${failures.length} order(s) failed to cancel`);
        setCancelAllError(true);
        setTimeout(() => setCancelAllError(false), 4000);
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (err) {
      console.error('Failed to cancel all orders', err);
      setCancelAllError(true);
      setTimeout(() => setCancelAllError(false), 4000);
      setCancelingIds(new Set());
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

  const visibleOrders = orders.filter((o) => !o.id || !cancelingIds.has(o.id));

  if (visibleOrders.length === 0 && cancelingIds.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">No open orders</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          New orders will appear here automatically
        </p>
      </div>
    );
  }

  if (visibleOrders.length === 0 && cancelingIds.size > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Cancelling orders&hellip;</p>
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
            {visibleOrders.length} order{visibleOrders.length !== 1 ? 's' : ''}
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
                  {cancelingAll ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Cancelling&hellip;
                    </span>
                  ) : (
                    'Yes'
                  )}
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

      {/* ── Cancel-all error ──────────────────────────────── */}
      {cancelAllError && (
        <p className="text-xs text-destructive">
          Some orders failed to cancel. Please try again.
        </p>
      )}

      {/* ── Order rows ──────────────────────────────────── */}
      <div className="rounded-xl border border-border/40 overflow-hidden shadow-surface">
        {visibleOrders.map((order, idx) => {
          const isBuy = order.side?.toLowerCase() === 'buy';
          const hasError = order.id ? errorIds.has(order.id) : false;
          const orderPrice = getOrderPrice(order);
          const isMarket = isMarketOrder(order);
          const posInfo = positionsBySymbol.get(order.symbol);

          // Determine the price to display:
          // - Limit/stop orders → exact price from order
          // - Market orders → current market price from position data (approximate)
          const displayPrice = orderPrice
            ? orderPrice
            : isMarket && posInfo?.current_price
              ? `~${posInfo.current_price}`
              : undefined;

          return (
            <div key={`${order.symbol}-${order.id || idx}`}>
              {idx > 0 && <Separator className="opacity-50" />}
              <div
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition-all duration-200 ease-out',
                  'hover:bg-muted/40',
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
                  <span className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {order.quantity || order.qty} qty
                  </span>
                  {order.type && (
                    <span className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {typeLabel(order.type)}
                    </span>
                  )}
                  {displayPrice && (
                    <span className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                      @ {displayPrice}
                    </span>
                  )}
                  {/* Cost basis from existing position */}
                  {posInfo?.avg_entry_price && (
                    <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[11px] tabular-nums text-primary font-medium">
                      {isBuy ? 'Avg cost' : 'Buy in'}: {posInfo.avg_entry_price}
                    </span>
                  )}
                  {order.time_in_force && (
                    <span className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {tifLabel(order.time_in_force)}
                    </span>
                  )}
                  {/* ── Inline error message ───────────────── */}
                  {hasError && (
                    <span className="inline-flex items-center rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive font-medium">
                      Cancel failed
                    </span>
                  )}
                </div>

                {/* ── Right: Status pill + cancel ──────────── */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2 py-0.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inset-0 rounded-full bg-amber-400/60 animate-ping" style={{ animationDuration: '2s' }} />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Pending
                    </span>
                  </span>

                  {order.id && (
                    <button
                      onClick={() => handleCancel(order.id)}
                      disabled={false}
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
