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

/**
 * MarketAux free-tier caps at 3 articles per request.
 * To maximise coverage we split the symbol list into small batches,
 * fire parallel requests, then deduplicate & merge the results.
 */
const FREE_TIER_LIMIT = 3;

async function fetchSingleBatch(
  apiKey: string,
  symbols: string[],
  start?: string,
  end?: string,
): Promise<MarketAuxArticle[]> {
  const searchParams = new URLSearchParams();
  searchParams.set('api_token', apiKey);
  if (symbols.length > 0) {
    searchParams.set('symbols', symbols.join(','));
  }
  if (start) searchParams.set('published_after', start);
  if (end) searchParams.set('published_before', end);
  searchParams.set('limit', String(FREE_TIER_LIMIT));
  searchParams.set('filter_entities', 'true');
  searchParams.set('language', 'en');
  searchParams.set('sort', 'published_at');

  const url = `https://api.marketaux.com/v1/news/all?${searchParams.toString()}`;
  console.log(`[marketaux] Fetching: symbols=${symbols.join(',') || 'all'}`);

  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[marketaux] API error ${response.status}: ${errorText.substring(0, 200)}`);
    return [];
  }

  const payload: any = await response.json();
  const data = Array.isArray(payload?.data) ? payload.data : [];
  console.log(`[marketaux] Got ${data.length} articles for [${symbols.join(',')}]`);

  return data.map((item: any): MarketAuxArticle => {
    const entities = Array.isArray(item?.entities) ? item.entities : [];
    const entitySymbols = entities
      .map((entity: any) => String(entity?.symbol || '').trim().toUpperCase())
      .filter(Boolean);
    const sentimentEntity = entities.find(
      (entity: any) => entity?.sentiment_score !== undefined || entity?.sentiment,
    );
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
}

/** Split an array into chunks of `size`. */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function fetchMarketAuxNews(params: MarketAuxParams): Promise<MarketAuxResponse> {
  const apiKey = process.env.MARKETAUX_API_KEY || process.env.MARKET_AUX_API_KEY;
  if (!apiKey) {
    console.warn('[marketaux] No MARKETAUX_API_KEY found in env');
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
    console.log(`[marketaux] Cache hit (${cached.data.articles.length} articles)`);
    return cached.data;
  }

  const symbols = params.symbols || [];
  const desiredTotal = params.limit && params.limit > 0 ? params.limit : 50;

  // Build batches: split symbols into groups of 2 so each request
  // returns unique articles.  Also include one "no-symbol" request
  // for general market news.
  const batches: string[][] = [];
  if (symbols.length > 0) {
    const symbolChunks = chunkArray(symbols, 2);
    batches.push(...symbolChunks);
  }
  // Always add a general (no-symbol) batch for broad market news
  batches.push([]);

  console.log(`[marketaux] Firing ${batches.length} parallel batch(es) for ${symbols.length} symbols`);

  // Fire all batches in parallel
  const batchResults = await Promise.allSettled(
    batches.map((batchSymbols) =>
      fetchSingleBatch(apiKey, batchSymbols, params.start, params.end),
    ),
  );

  // Merge & deduplicate
  const seen = new Set<string>();
  const allArticles: MarketAuxArticle[] = [];
  for (const result of batchResults) {
    if (result.status !== 'fulfilled') continue;
    for (const article of result.value) {
      const key = article.url || article.title;
      if (seen.has(key)) continue;
      seen.add(key);
      allArticles.push(article);
    }
  }

  // Sort by published date descending and trim to desired total
  allArticles.sort((a, b) => String(b.published_date).localeCompare(String(a.published_date)));
  const trimmed = allArticles.slice(0, desiredTotal);

  console.log(`[marketaux] Merged ${allArticles.length} unique articles, returning ${trimmed.length}`);

  const responseData: MarketAuxResponse = {
    articles: trimmed,
    count: trimmed.length,
    start_date: params.start || '',
    end_date: params.end || '',
    symbols,
  };

  cache.set(cacheKey, { expiresAt: Date.now() + 5 * 60 * 1000, data: responseData });
  return responseData;
}
