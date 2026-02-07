export interface MCPToolCall {
  name: string;
  arguments?: Record<string, any>;
}

export interface MCPToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export interface Position {
  symbol: string;
  qty: number;
  market_value: number;
  avg_entry_price: number;
  current_price: number;
  unrealized_pl: number;
  unrealized_plpc: number;
}

export interface AccountInfo {
  id: string;
  status: string;
  currency: string;
  buying_power: number;
  cash: number;
  portfolio_value: number;
  equity: number;
  long_market_value: number;
  short_market_value: number;
  pattern_day_trader: boolean;
  daytrade_count?: number;
}

export interface Order {
  id: string;
  client_order_id: string;
  symbol: string;
  side: string;
  type: string;
  status: string;
  qty: number;
  filled_qty?: number;
  filled_avg_price?: number;
  limit_price?: number;
  stop_price?: number;
  time_in_force: string;
  created_at: string;
  updated_at: string;
}

export interface PlaceOrderRequest {
  symbol: string;
  side: string;
  quantity: number;
  type?: string;
  time_in_force?: string;
  limit_price?: number;
  stop_price?: number;
  trail_price?: number;
  trail_percent?: number;
  extended_hours?: boolean;
  client_order_id?: string;
}
