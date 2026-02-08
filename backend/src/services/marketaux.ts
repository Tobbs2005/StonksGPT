type MarketAuxParams = {
  symbols?: string[];
  limit?: number;
  start?: string;
  end?: string;
};

type MarketAuxArticle = {
  title: string;
  source: string;
  published_date: string;
  summary: string;
  url: string;
  symbols: string[];
  sentiment_score?: number;
  sentiment_label?: string;
};

type MarketAuxResponse = {
  articles: MarketAuxArticle[];
  count: number;
  start_date: string;
  end_date: string;
  symbols: string[];
  error?: string;
};

const cache = new Map<string, { expiresAt: number; data: MarketAuxResponse }>();

const buildCacheKey = (params: MarketAuxParams) => {
  const symbols = (params.symbols || []).map((s) => s.toUpperCase()).sort().join(',');
  return `${symbols}|${params.start || ''}|${params.end || ''}|${params.limit || ''}`;
};

const toNewsDate = (isoDate: string | undefined) => {
  if (!isoDate) {
    return '';
  }
  const trimmed = isoDate.replace('Z', '');
  const [datePart, timePart = ''] = trimmed.split('T');
  const compactDate = datePart.replace(/-/g, '');
  const compactTime = timePart.replace(/:/g, '').slice(0, 6);
  return compactTime ? `${compactDate}T${compactTime}` : compactDate;
};

const normalizeSentiment = (value: any): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const lowered = value.toLowerCase();
  if (['positive', 'negative', 'neutral'].includes(lowered)) {
    return lowered;
  }
  return undefined;
};

export async function fetchMarketAuxNews(params: MarketAuxParams): Promise<MarketAuxResponse> {
  const apiKey = process.env.MARKETAUX_API_KEY || process.env.MARKET_AUX_API_KEY;
  if (!apiKey) {
    return {
      articles: [],
      count: 0,
      start_date: params.start || '',
      end_date: params.end || '',
      symbols: params.symbols || [],
      error: 'MARKETAUX_API_KEY not configured',
    };
  }

  const cacheKey = buildCacheKey(params);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const searchParams = new URLSearchParams();
  searchParams.set('api_token', apiKey);
  if (params.symbols && params.symbols.length > 0) {
    searchParams.set('symbols', params.symbols.join(','));
  }
  if (params.start) {
    searchParams.set('published_after', params.start);
  }
  if (params.end) {
    searchParams.set('published_before', params.end);
  }
  if (params.limit) {
    searchParams.set('limit', String(params.limit));
  }
  searchParams.set('filter_entities', 'true');

  const url = `https://api.marketaux.com/v1/news/all?${searchParams.toString()}`;
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    const errorText = await response.text();
    return {
      articles: [],
      count: 0,
      start_date: params.start || '',
      end_date: params.end || '',
      symbols: params.symbols || [],
      error: `Marketaux API error: ${response.status} ${errorText}`,
    };
  }

  const payload: any = await response.json();
  const data = Array.isArray(payload?.data) ? payload.data : [];
  const articles = data.map((item: any): MarketAuxArticle => {
    const entities = Array.isArray(item?.entities) ? item.entities : [];
    const entitySymbols = entities
      .map((entity: any) => String(entity?.symbol || '').trim().toUpperCase())
      .filter(Boolean);
    const sentimentEntity = entities.find((entity: any) => entity?.sentiment_score !== undefined || entity?.sentiment);
    return {
      title: item?.title || 'Untitled',
      source: item?.source?.name || item?.source || item?.source_domain || 'Unknown',
      published_date: toNewsDate(item?.published_at),
      summary: item?.description || item?.snippet || '',
      url: item?.url || '',
      symbols: entitySymbols,
      sentiment_score: sentimentEntity?.sentiment_score,
      sentiment_label: normalizeSentiment(sentimentEntity?.sentiment),
    };
  });

  const responseData: MarketAuxResponse = {
    articles,
    count: articles.length,
    start_date: params.start || '',
    end_date: params.end || '',
    symbols: params.symbols || [],
  };

  cache.set(cacheKey, { expiresAt: Date.now() + 5 * 60 * 1000, data: responseData });
  return responseData;
}
