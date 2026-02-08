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

export type ChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const chatApi = {
  // Send natural language message to LLM service (uses Dedalus Labs MCP)
  sendMessage: async (message: string, history?: ChatHistoryMessage[]): Promise<string> => {
    const response = await api.post<ApiResponse<string>>('/chat/llm', {
      message,
      history,
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

export interface NewsArticle {
  title: string;
  source: string;
  published_date: string;
  summary: string;
  url: string;
  symbols: string[];
  sentiment_score?: number;
  sentiment_label?: string;
}

export interface NewsResponse {
  articles: NewsArticle[];
  count: number;
  start_date: string;
  end_date: string;
  symbols: string[];
  error?: string;
  message?: string;
}

export const newsApi = {
  getNews: async (params?: {
    symbols?: string[];
    start?: string;
    end?: string;
    limit?: number;
  }): Promise<NewsResponse> => {
    const queryParams: Record<string, string> = {};
    if (params?.symbols && params.symbols.length > 0) {
      queryParams.symbols = params.symbols.join(',');
    }
    if (params?.start) {
      queryParams.start = params.start;
    }
    if (params?.end) {
      queryParams.end = params.end;
    }
    if (params?.limit) {
      queryParams.limit = params.limit.toString();
    }
    
    const response = await api.get<ApiResponse<NewsResponse>>('/news', { params: queryParams });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch news');
    }
    return response.data.data || { articles: [], count: 0, start_date: '', end_date: '', symbols: [] };
  },
  
  getWatchlistNews: async (params?: {
    start?: string;
    end?: string;
    limit?: number;
  }): Promise<NewsResponse> => {
    const queryParams: Record<string, string> = {};
    if (params?.start) {
      queryParams.start = params.start;
    }
    if (params?.end) {
      queryParams.end = params.end;
    }
    if (params?.limit) {
      queryParams.limit = params.limit.toString();
    }
    
    const response = await api.get<ApiResponse<NewsResponse>>('/news/watchlist', { params: queryParams });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch watchlist news');
    }
    return response.data.data || { articles: [], count: 0, start_date: '', end_date: '', symbols: [] };
  },

  getPortfolioNews: async (params?: {
    start?: string;
    end?: string;
    limit?: number;
  }): Promise<NewsResponse> => {
    const queryParams: Record<string, string> = {};
    if (params?.start) {
      queryParams.start = params.start;
    }
    if (params?.end) {
      queryParams.end = params.end;
    }
    if (params?.limit) {
      queryParams.limit = params.limit.toString();
    }
    
    const response = await api.get<ApiResponse<NewsResponse>>('/news/portfolio', { params: queryParams });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch portfolio news');
    }
    return response.data.data || { articles: [], count: 0, start_date: '', end_date: '', symbols: [] };
  },
  
  syncWatchlist: async (): Promise<{ success: boolean; symbolsAdded: string[]; totalSymbols: number; error?: string }> => {
    const response = await api.post<ApiResponse<{ success: boolean; symbolsAdded: string[]; totalSymbols: number; error?: string }>>('/news/sync-watchlist');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to sync watchlist');
    }
    return response.data.data || { success: false, symbolsAdded: [], totalSymbols: 0 };
  },
};

export default api;
