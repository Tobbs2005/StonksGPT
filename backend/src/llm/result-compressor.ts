/**
 * Tool Result Compressor
 * 
 * Compresses verbose MCP tool outputs into minimal structured facts.
 * The planner needs facts, not data.
 */

/**
 * Compresses tool results by extracting only essential facts
 */
export function compressToolResult(toolName: string, rawResult: string): string {
  if (!rawResult || rawResult.trim().length === 0) {
    return rawResult;
  }

  // Route to tool-specific compressors
  switch (toolName) {
    case 'get_account_info':
      return compressAccountInfo(rawResult);
    
    case 'get_all_positions':
      return compressPositions(rawResult);
    
    case 'get_open_position':
      return compressOpenPosition(rawResult);
    
    case 'get_stock_bars':
      return compressStockBars(rawResult);
    
    case 'get_stock_snapshot':
      return compressStockSnapshot(rawResult);
    
    case 'get_crypto_snapshot':
      return compressCryptoSnapshot(rawResult);
    
    case 'get_stock_latest_quote':
      return compressStockLatestQuote(rawResult);
    
    case 'get_stock_latest_trade':
      return compressStockLatestTrade(rawResult);
    
    case 'get_stock_latest_bar':
      return compressStockLatestBar(rawResult);
    
    case 'get_orders':
      return compressOrders(rawResult);
    
    case 'place_stock_order':
      return compressOrderPlacement(rawResult);
    
    case 'get_asset':
      return compressAssetInfo(rawResult);
    
    case 'get_all_assets':
      return compressAllAssets(rawResult);
    
    case 'get_portfolio_history':
      return compressPortfolioHistory(rawResult);
    
    case 'get_calendar':
      return compressCalendar(rawResult);
    
    case 'get_clock':
      return compressClock(rawResult);
    
    case 'get_watchlists':
    case 'get_watchlist_by_id':
      return compressWatchlists(rawResult);
    
    case 'web_search':
    case 'search_stock_symbols':
      // Don't compress web search results - they need full context
      // But limit to reasonable size to avoid token limits
      if (rawResult.length > 8000) {
        return rawResult.substring(0, 8000) + '\n\n... (truncated for length)';
      }
      return rawResult;
    
    default:
      return compressDefault(rawResult);
  }
}

/**
 * Compress account info: extract balance, buying_power, equity
 */
function compressAccountInfo(rawResult: string): string {
  const cashMatch = rawResult.match(/Cash:\s*\$\s*([\d,]+\.?\d*)/i);
  const buyingPowerMatch = rawResult.match(/Buying Power:\s*\$\s*([\d,]+\.?\d*)/i);
  const equityMatch = rawResult.match(/Equity:\s*\$\s*([\d,]+\.?\d*)/i);
  
  const cash = cashMatch ? cashMatch[1].replace(/,/g, '') : 'N/A';
  const buyingPower = buyingPowerMatch ? buyingPowerMatch[1].replace(/,/g, '') : 'N/A';
  const equity = equityMatch ? equityMatch[1].replace(/,/g, '') : 'N/A';
  
  return `Account: balance=$${cash}, buying_power=$${buyingPower}, equity=$${equity}`;
}

/**
 * Compress positions: extract symbol, qty, market_value per position
 */
function compressPositions(rawResult: string): string {
  if (rawResult.includes('No open positions')) {
    return 'Positions: none';
  }

  const positions: string[] = [];
  const positionBlocks = rawResult.split(/Symbol:\s*([A-Z]+)/);
  
  for (let i = 1; i < positionBlocks.length; i += 2) {
    const symbol = positionBlocks[i];
    const details = positionBlocks[i + 1] || '';
    
    const qtyMatch = details.match(/Quantity:\s*([\d.]+)/i);
    const marketValueMatch = details.match(/Market Value:\s*\$\s*([\d,]+\.?\d*)/i);
    
    const qty = qtyMatch ? qtyMatch[1] : 'N/A';
    const marketValue = marketValueMatch ? marketValueMatch[1].replace(/,/g, '') : 'N/A';
    
    positions.push(`${symbol} ${qty} shares ($${marketValue})`);
  }
  
  return positions.length > 0 
    ? `Positions: ${positions.join(', ')}`
    : 'Positions: none';
}

/**
 * Compress single position: extract symbol, qty, market_value, current_price
 */
function compressOpenPosition(rawResult: string): string {
  if (rawResult.includes('Error')) {
    return rawResult;
  }

  const symbolMatch = rawResult.match(/Position Details for\s+([A-Z]+)/i);
  const qtyMatch = rawResult.match(/Quantity:\s*([\d.]+)/i);
  const marketValueMatch = rawResult.match(/Market Value:\s*\$\s*([\d,]+\.?\d*)/i);
  const currentPriceMatch = rawResult.match(/Current Price:\s*\$\s*([\d,]+\.?\d*)/i);
  
  const symbol = symbolMatch ? symbolMatch[1] : 'N/A';
  const qty = qtyMatch ? qtyMatch[1] : 'N/A';
  const marketValue = marketValueMatch ? marketValueMatch[1].replace(/,/g, '') : 'N/A';
  const currentPrice = currentPriceMatch ? currentPriceMatch[1].replace(/,/g, '') : 'N/A';
  
  return `${symbol}: ${qty} shares, value=$${marketValue}, price=$${currentPrice}`;
}

/**
 * Compress stock bars: extract latest close price
 */
function compressStockBars(rawResult: string): string {
  if (rawResult.includes('No bar data') || rawResult.includes('Error')) {
    return rawResult.substring(0, 200);
  }

  // Extract symbol from header
  const symbolMatch = rawResult.match(/Historical Bars for\s+([A-Z]+)/i);
  const symbol = symbolMatch ? symbolMatch[1] : 'N/A';
  
  // Find the last (most recent) close price
  const closeMatches = rawResult.matchAll(/Close:\s*\$\s*([\d.]+)/gi);
  const closes: string[] = [];
  for (const match of closeMatches) {
    closes.push(match[1]);
  }
  
  if (closes.length > 0) {
    const latestClose = closes[closes.length - 1];
    return `${symbol}: $${latestClose}`;
  }
  
  // Fallback: return first 200 chars
  return rawResult.substring(0, 200);
}

/**
 * Compress stock snapshot: extract current price, bid, ask
 */
function compressStockSnapshot(rawResult: string): string {
  if (rawResult.includes('No data') || rawResult.includes('Error')) {
    return rawResult.substring(0, 200);
  }

  // Extract symbol
  const symbolMatch = rawResult.match(/Symbol:\s*([A-Z]+)/i);
  const symbol = symbolMatch ? symbolMatch[1] : 'N/A';
  
  // Extract latest quote prices
  const bidMatch = rawResult.match(/Bid Price:\s*\$\s*([\d.]+)/i);
  const askMatch = rawResult.match(/Ask Price:\s*\$\s*([\d.]+)/i);
  const lastMatch = rawResult.match(/Last Price:\s*\$\s*([\d.]+)/i);
  
  const bid = bidMatch ? bidMatch[1] : 'N/A';
  const ask = askMatch ? askMatch[1] : 'N/A';
  const last = lastMatch ? lastMatch[1] : 'N/A';
  
  return `${symbol}: $${last} (bid: $${bid}, ask: $${ask})`;
}

/**
 * Compress crypto snapshot: extract current price, bid, ask
 */
function compressCryptoSnapshot(rawResult: string): string {
  if (rawResult.includes('No data') || rawResult.includes('Error')) {
    return rawResult.substring(0, 200);
  }

  // Extract crypto symbol (e.g., "BTC/USD")
  const symbolMatch = rawResult.match(/Crypto Snapshot for\s+([A-Z/]+)/i) || 
                      rawResult.match(/Symbol:\s*([A-Z/]+)/i);
  const symbol = symbolMatch ? symbolMatch[1] : 'N/A';
  
  // Extract latest quote prices
  const bidMatch = rawResult.match(/Bid Price:\s*\$\s*([\d.]+)/i);
  const askMatch = rawResult.match(/Ask Price:\s*\$\s*([\d.]+)/i);
  const priceMatch = rawResult.match(/Price:\s*\$\s*([\d.]+)/i);
  
  const bid = bidMatch ? bidMatch[1] : 'N/A';
  const ask = askMatch ? askMatch[1] : 'N/A';
  const price = priceMatch ? priceMatch[1] : 'N/A';
  
  return `${symbol}: $${price} (bid: $${bid}, ask: $${ask})`;
}

/**
 * Compress latest quote: extract bid, ask, last
 */
function compressStockLatestQuote(rawResult: string): string {
  const symbolMatch = rawResult.match(/Latest Quote for\s+([A-Z]+)/i) || rawResult.match(/Symbol:\s*([A-Z]+)/i);
  const symbol = symbolMatch ? symbolMatch[1] : 'N/A';
  
  const bidMatch = rawResult.match(/Bid Price:\s*\$\s*([\d.]+)/i);
  const askMatch = rawResult.match(/Ask Price:\s*\$\s*([\d.]+)/i);
  
  const bid = bidMatch ? bidMatch[1] : 'N/A';
  const ask = askMatch ? askMatch[1] : 'N/A';
  
  return `${symbol}: bid=$${bid}, ask=$${ask}`;
}

/**
 * Compress latest trade: extract price
 */
function compressStockLatestTrade(rawResult: string): string {
  const symbolMatch = rawResult.match(/Latest Trade for\s+([A-Z]+)/i) || rawResult.match(/Symbol:\s*([A-Z]+)/i);
  const symbol = symbolMatch ? symbolMatch[1] : 'N/A';
  
  const priceMatch = rawResult.match(/Price:\s*\$\s*([\d.]+)/i);
  const price = priceMatch ? priceMatch[1] : 'N/A';
  
  return `${symbol}: $${price}`;
}

/**
 * Compress latest bar: extract close price
 */
function compressStockLatestBar(rawResult: string): string {
  const symbolMatch = rawResult.match(/Latest Bar for\s+([A-Z]+)/i) || rawResult.match(/Symbol:\s*([A-Z]+)/i);
  const symbol = symbolMatch ? symbolMatch[1] : 'N/A';
  
  const closeMatch = rawResult.match(/Close:\s*\$\s*([\d.]+)/i);
  const close = closeMatch ? closeMatch[1] : 'N/A';
  
  return `${symbol}: $${close}`;
}

/**
 * Compress orders: extract order_id, symbol, side, qty, status
 */
function compressOrders(rawResult: string): string {
  if (rawResult.includes('No ') && rawResult.includes('orders found')) {
    return rawResult.substring(0, 100);
  }

  const orders: string[] = [];
  const orderBlocks = rawResult.split(/Symbol:\s*([A-Z]+)/);
  
  for (let i = 1; i < orderBlocks.length; i += 2) {
    const symbol = orderBlocks[i];
    const details = orderBlocks[i + 1] || '';
    
    const idMatch = details.match(/ID:\s*([a-f0-9-]+)/i);
    const sideMatch = details.match(/Side:\s*(\w+)/i);
    const qtyMatch = details.match(/Quantity:\s*([\d.]+)/i);
    const statusMatch = details.match(/Status:\s*(\w+)/i);
    
    const id = idMatch ? idMatch[1].substring(0, 8) : 'N/A';
    const side = sideMatch ? sideMatch[1].toUpperCase() : 'N/A';
    const qty = qtyMatch ? qtyMatch[1] : 'N/A';
    const status = statusMatch ? statusMatch[1] : 'N/A';
    
    orders.push(`#${id} ${symbol} ${side} ${qty} shares (${status})`);
  }
  
  return orders.length > 0 
    ? `Orders: ${orders.join(', ')}`
    : 'Orders: none';
}

/**
 * Compress order placement: extract order_id, symbol, status
 */
function compressOrderPlacement(rawResult: string): string {
  if (rawResult.includes('Error')) {
    return rawResult.substring(0, 200);
  }

  const idMatch = rawResult.match(/id:\s*([a-f0-9-]+)/i);
  const symbolMatch = rawResult.match(/symbol:\s*([A-Z]+)/i);
  const sideMatch = rawResult.match(/side:\s*(\w+)/i);
  const qtyMatch = rawResult.match(/qty:\s*([\d.]+)/i);
  const statusMatch = rawResult.match(/status:\s*(\w+)/i);
  
  const id = idMatch ? idMatch[1].substring(0, 8) : 'N/A';
  const symbol = symbolMatch ? symbolMatch[1] : 'N/A';
  const side = sideMatch ? sideMatch[1].toUpperCase() : 'N/A';
  const qty = qtyMatch ? qtyMatch[1] : 'N/A';
  const status = statusMatch ? statusMatch[1] : 'N/A';
  
  return `Order placed: #${id} ${symbol} ${side} ${qty} shares (${status})`;
}

/**
 * Compress asset info: extract symbol, name, tradable status
 */
function compressAssetInfo(rawResult: string): string {
  if (rawResult.includes('Error')) {
    return rawResult.substring(0, 200);
  }

  const symbolMatch = rawResult.match(/Asset Information for\s+([A-Z]+)/i);
  const nameMatch = rawResult.match(/Name:\s*(.+)/i);
  const tradableMatch = rawResult.match(/Tradable:\s*(Yes|No)/i);
  
  const symbol = symbolMatch ? symbolMatch[1] : 'N/A';
  const name = nameMatch ? nameMatch[1].trim() : 'N/A';
  const tradable = tradableMatch ? tradableMatch[1] : 'N/A';
  
  return `${symbol}: ${name} (${tradable === 'Yes' ? 'tradable' : 'not tradable'})`;
}

/**
 * Compress all assets: extract top 5 symbols
 */
function compressAllAssets(rawResult: string): string {
  if (rawResult.includes('Error') || rawResult.includes('No assets')) {
    return rawResult.substring(0, 200);
  }

  const symbolMatches = rawResult.matchAll(/Symbol:\s*([A-Z]+)/gi);
  const symbols: string[] = [];
  for (const match of symbolMatches) {
    symbols.push(match[1]);
    if (symbols.length >= 5) break;
  }
  
  return symbols.length > 0 
    ? `Assets: ${symbols.join(', ')}${symbols.length === 5 ? '...' : ''}`
    : 'Assets: none';
}

/**
 * Compress portfolio history: extract latest equity
 */
function compressPortfolioHistory(rawResult: string): string {
  if (rawResult.includes('Error') || rawResult.includes('No data')) {
    return rawResult.substring(0, 200);
  }

  // Extract latest equity value
  const equityMatches = rawResult.matchAll(/Equity:\s*\$\s*([\d,]+\.?\d*)/gi);
  const equities: string[] = [];
  for (const match of equityMatches) {
    equities.push(match[1].replace(/,/g, ''));
  }
  
  if (equities.length > 0) {
    const latestEquity = equities[equities.length - 1];
    return `Portfolio equity: $${latestEquity}`;
  }
  
  return rawResult.substring(0, 200);
}

/**
 * Compress calendar: extract next trading day
 */
function compressCalendar(rawResult: string): string {
  if (rawResult.includes('Error')) {
    return rawResult.substring(0, 200);
  }

  // Extract first trading day
  const dateMatch = rawResult.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return `Next trading day: ${dateMatch[1]}`;
  }
  
  return rawResult.substring(0, 200);
}

/**
 * Compress clock: extract market status
 */
function compressClock(rawResult: string): string {
  const statusMatch = rawResult.match(/Market Status:\s*(\w+)/i);
  const status = statusMatch ? statusMatch[1] : 'N/A';
  
  const nextOpenMatch = rawResult.match(/Next Open:\s*([^\n]+)/i);
  const nextCloseMatch = rawResult.match(/Next Close:\s*([^\n]+)/i);
  
  const nextOpen = nextOpenMatch ? nextOpenMatch[1].trim() : 'N/A';
  const nextClose = nextCloseMatch ? nextCloseMatch[1].trim() : 'N/A';
  
  return `Market: ${status} (next open: ${nextOpen}, next close: ${nextClose})`;
}

/**
 * Compress watchlists: extract watchlist names and symbols
 */
function compressWatchlists(rawResult: string): string {
  if (rawResult.includes('Error') || rawResult.includes('No watchlists')) {
    return rawResult.substring(0, 200);
  }

  const watchlistMatches = rawResult.matchAll(/Watchlist Name:\s*([^\n]+)/gi);
  const watchlists: string[] = [];
  for (const match of watchlistMatches) {
    watchlists.push(match[1].trim());
    if (watchlists.length >= 3) break;
  }
  
  return watchlists.length > 0 
    ? `Watchlists: ${watchlists.join(', ')}${watchlists.length === 3 ? '...' : ''}`
    : 'Watchlists: none';
}

/**
 * Default compressor: truncate if too long
 */
function compressDefault(rawResult: string): string {
  if (rawResult.length <= 500) {
    return rawResult;
  }
  
  return rawResult.substring(0, 500) + '... (truncated)';
}
