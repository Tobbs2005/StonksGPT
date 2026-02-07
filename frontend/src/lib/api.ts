import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorType?: string;
  suggestions?: string[];
  details?: string;
}

export const accountApi = {
  getAccountInfo: async (): Promise<string> => {
    const response = await api.get<ApiResponse<string>>('/account');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch account info');
    }
    return response.data.data || '';
  },
};

export const positionsApi = {
  getAllPositions: async (): Promise<string> => {
    const response = await api.get<ApiResponse<string>>('/positions');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch positions');
    }
    return response.data.data || '';
  },
  getPosition: async (symbol: string): Promise<string> => {
    const response = await api.get<ApiResponse<string>>(`/positions/${symbol}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch position');
    }
    return response.data.data || '';
  },
  closePosition: async (symbol: string, qty?: string, percentage?: string): Promise<string> => {
    const response = await api.post<ApiResponse<string>>(`/positions/${symbol}/close`, {
      qty,
      percentage,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to close position');
    }
    return response.data.data || '';
  },
};

export const ordersApi = {
  getOrders: async (params?: {
    status?: string;
    limit?: number;
    symbols?: string[];
  }): Promise<string> => {
    const response = await api.get<ApiResponse<string>>('/orders', { params });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch orders');
    }
    return response.data.data || '';
  },
  cancelOrder: async (orderId: string): Promise<string> => {
    const response = await api.delete<ApiResponse<string>>(`/orders/${orderId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to cancel order');
    }
    return response.data.data || '';
  },
  placeStockOrder: async (order: {
    symbol: string;
    side: string;
    quantity: number;
    type?: string;
    time_in_force?: string;
    limit_price?: number;
    stop_price?: number;
    extended_hours?: boolean;
  }): Promise<string> => {
    const response = await api.post<ApiResponse<string>>('/orders/stock', order);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to place order');
    }
    return response.data.data || '';
  },
};

export const chatApi = {
  // Send natural language message to LLM service (uses Dedalus Labs MCP)
  sendMessage: async (message: string): Promise<string> => {
    const response = await api.post<ApiResponse<string>>('/chat/llm', {
      message,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to send message');
    }
    return response.data.data || '';
  },
  // Legacy method - call tool directly (bypasses LLM)
  callToolDirect: async (toolName: string, args?: Record<string, any>): Promise<string> => {
    const response = await api.post<ApiResponse<string>>('/chat/message', {
      toolName,
      arguments: args || {},
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to call tool');
    }
    return response.data.data || '';
  },
  callTool: async (toolName: string, args?: Record<string, any>): Promise<string> => {
    const response = await api.post<ApiResponse<string>>('/chat/tool', {
      name: toolName,
      arguments: args || {},
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to call tool');
    }
    return response.data.data || '';
  },
  listTools: async (): Promise<string[]> => {
    const response = await api.get<ApiResponse<string[]>>('/chat/tools');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to list tools');
    }
    return response.data.data || [];
  },
  // Get chart data directly
  getChartData: async (symbol: string, timeframe?: string): Promise<any> => {
    const response = await api.post<ApiResponse<any>>('/chart/data', {
      symbol,
      timeframe: timeframe || '1mo',
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch chart data');
    }
    return response.data.data;
  },
};

export default api;
