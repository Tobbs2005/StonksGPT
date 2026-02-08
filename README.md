# StonksGPT

A full-stack AI trading assistant that combines real-time market data, voice-powered conversations, interactive charting, and safe trade execution through the Alpaca Trading API and Model Context Protocol (MCP).

Users can manage portfolios, analyze stocks with side-by-side charts, stay current with market news, and execute trades — all through a modern dashboard with natural-language chat and ElevenLabs-powered voice calls.

---

## Features

### AI Chat Assistant
- Natural-language chat powered by configurable LLMs (OpenAI, Anthropic, Google Gemini, Dedalus Labs)
- Context-aware responses with full conversation history
- Automatic chart generation when discussing stocks
- Multi-ticker comparison charts (e.g. "compare AAPL vs TSLA vs MSFT")
- Inline news results for mentioned symbols
- Markdown-rendered responses with rich formatting

### Voice Calls (ElevenLabs)
- Real-time voice conversations with the AI assistant
- Speech-to-text via ElevenLabs Realtime STT (WebSocket bridge through backend)
- Text-to-speech for AI responses via ElevenLabs TTS
- Live transcript display during calls
- Mute/unmute and interruption-safe end call
- Session playback: summarizes and reads back the entire session's chat history

### Portfolio & Account
- Real-time portfolio tracking with holdings, allocations, and unrealized P/L
- Interactive P/L charts with multiple timeframes
- Asset allocation ring chart
- Positions table with entry price, current price, and percentage change
- Account stats panel with buying power, equity, and cash balances
- Animated P/L sparklines and crossfade chart transitions

### Trading
- Order placement and management via Alpaca API (stocks, crypto, options)
- Pending orders view with live status, price indicators, and cancel controls
- Position-aware order display (shows buy-in price, current market price)
- Cancel individual orders or all orders at once

### Market Data & Charts
- Interactive stock charts powered by Lightweight Charts (candlestick + line)
- Multiple timeframes: 1D, 1W, 1M, 3M, 6M, 1Y, 5Y
- Side-by-side multi-ticker comparison with synchronized timeframes
- Client-side chart cache with adjacent timeframe prefetching
- Data sourced via Yahoo Finance

### News
- Market news feed with symbol-based filtering
- Watchlist mode synced with portfolio positions
- Trending and custom filter modes
- News sourced from MarketAux and Finnhub APIs

### Sessions
- Create multiple trading sessions per day
- Per-session chat history persisted in localStorage
- Voice call transcripts saved with sessions
- Session list with creation date, name, and description

### UI / UX
- Collapsible sidebar with smooth slide animation and backdrop overlay
- Hamburger menu toggle with Escape key support
- Full-width chat when sidebar is closed
- Dark/light mode toggle
- Responsive layout for desktop and mobile
- Custom app icon and branding

---

## Architecture

```
StonksGPT/
├── alpaca-mcp-server/       # Python MCP server (Alpaca trading tools)
│   └── src/
│       └── alpaca_mcp_server/
│           ├── server.py    # 50+ trading/market tools
│           └── helpers.py   # Order execution helpers
├── backend/                 # Express.js API + WebSocket server
│   └── src/
│       ├── mcp/             # MCP client wrapper (stdio transport)
│       ├── llm/             # LLM service, web search, result compression
│       ├── routes/          # REST endpoints (account, orders, positions, chat, tts, news, chart, portfolio)
│       └── ws/              # WebSocket handlers (STT bridge)
├── frontend/                # React + TypeScript application
│   └── src/
│       ├── components/
│       │   ├── Chat/        # ChatInterface, CallOverlay, MessageList, StockChart, ComparisonChart
│       │   ├── Account/     # PLChart, PLAnalysisView, PositionsTable, AssetRingChart
│       │   ├── Navigation/  # AppSidebar, TopBar
│       │   ├── News/        # NewsList, NewsFilter, WatchlistManager
│       │   ├── Sessions/    # SessionsList
│       │   ├── Sidebar/     # PositionsList, PendingOrdersList
│       │   ├── layout/      # DashboardLayout
│       │   └── ui/          # Reusable UI primitives (shadcn)
│       ├── lib/             # API client, sessions, chart cache, auth
│       └── pages/           # Route pages (App, Account, Sessions, News, Login)
└── dedalus-mcp/             # Dedalus Labs MCP integration
```

### Data Flow

```
User (Browser)
  ├─ Chat message ──→ Backend /api/chat/message ──→ LLM (OpenAI/Anthropic/Gemini)
  │                                                  ├─→ MCP tools (Alpaca trading)
  │                                                  └─→ Web search (Brave/DuckDuckGo)
  ├─ Voice audio ───→ Backend /ws/stt ──→ ElevenLabs Realtime STT ──→ transcript
  │                   Backend /api/tts ──→ ElevenLabs TTS ──→ audio response
  ├─ Chart request ─→ Backend /api/chart ──→ Yahoo Finance
  └─ Trade action ──→ Backend /api/orders ──→ MCP → Alpaca Trading API
```

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, TanStack React Query, Lightweight Charts, Radix UI, Lucide Icons, Axios |
| **Backend** | Node.js, Express, TypeScript, WebSocket (ws), Model Context Protocol SDK |
| **AI / LLM** | OpenAI GPT-4o, Anthropic Claude, Google Gemini, Dedalus Labs |
| **Voice** | ElevenLabs (Realtime STT + TTS) |
| **Trading** | Alpaca API (paper + live), Python MCP Server |
| **Data** | Yahoo Finance, MarketAux, Finnhub |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+ with `uv` installed (`pip install uv`)
- Alpaca API credentials ([sign up for paper trading](https://app.alpaca.markets/signup))
- At least one LLM API key (OpenAI, Anthropic, or Gemini)
- ElevenLabs API key (optional, for voice calls)

### 1. Clone and configure environment

```bash
git clone https://github.com/Tobbs2005/StonksGPT.git
cd StonksGPT
```

Create a `.env` file in the `alpaca-mcp-server/` directory:

```bash
# Required — Alpaca Trading
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET_KEY=your_alpaca_secret_key
ALPACA_PAPER_TRADE=True

# Required — LLM Provider (pick one)
LLM_PROVIDER=openai          # openai | anthropic | gemini | dedalus
OPENAI_API_KEY=your_key       # if using OpenAI
ANTHROPIC_API_KEY=your_key    # if using Anthropic
GEMINI_API_KEY=your_key       # if using Gemini
LLM_MODEL=gpt-4o             # model name for chosen provider

# Optional — Voice Calls (ElevenLabs)
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id    # default: Rachel

# Optional — News APIs
FINNHUB_API_KEY=your_finnhub_key
MARKETAUX_API_KEY=your_marketaux_key
```

### 2. Start the backend

```bash
cd backend
npm install
npm run dev
```

The backend starts on `http://localhost:3001`.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on `http://localhost:5173`.

---

## API Endpoints

### Account & Portfolio
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/account` | Account information |
| GET | `/api/positions` | All open positions |
| GET | `/api/positions/:symbol` | Specific position |
| POST | `/api/positions/:symbol/close` | Close a position |
| GET | `/api/portfolio/history` | Portfolio equity history |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | Get orders (query: status, limit, symbols) |
| POST | `/api/orders/stock` | Place stock order |
| POST | `/api/orders/crypto` | Place crypto order |
| POST | `/api/orders/option` | Place options order |
| DELETE | `/api/orders/:id` | Cancel order by ID |
| DELETE | `/api/orders` | Cancel all orders |

### Chat & AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/message` | Send natural-language message (uses LLM + MCP tools) |
| POST | `/api/chat/to-speakable` | Convert AI text to conversational speech |
| POST | `/api/chat/summarize-session` | Summarize session history for playback |
| GET | `/api/chat/tools` | List available MCP tools |

### Voice & Media
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tts` | Text-to-speech (returns audio/mpeg) |
| WS | `/ws/stt` | Real-time speech-to-text WebSocket bridge |

### Market Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chart/:symbol` | Stock chart data (query: timeframe) |
| GET | `/api/news` | Market news (query: symbols, mode) |

---

## Frontend Routes

| Route | Page | Description |
|-------|------|-------------|
| `/app` | Home | Session creation, recent sessions list |
| `/sessions` | Sessions | Full session list with management |
| `/sessions/:id/chat` | Chat | Session-scoped chat workspace with voice calls |
| `/account` | Account | Portfolio dashboard (Assets, Orders, History tabs) |
| `/news` | News | Market news with watchlist filtering |
| `/login` | Login | Authentication page |

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ALPACA_API_KEY` | Yes | Alpaca trading API key |
| `ALPACA_SECRET_KEY` | Yes | Alpaca trading secret key |
| `ALPACA_PAPER_TRADE` | No | Enable paper trading (default: True) |
| `LLM_PROVIDER` | Yes | LLM provider: `openai`, `anthropic`, `gemini`, `dedalus` |
| `OPENAI_API_KEY` | Conditional | Required if LLM_PROVIDER=openai |
| `ANTHROPIC_API_KEY` | Conditional | Required if LLM_PROVIDER=anthropic |
| `GEMINI_API_KEY` | Conditional | Required if LLM_PROVIDER=gemini |
| `DEDALUS_API_KEY` | Conditional | Required if LLM_PROVIDER=dedalus |
| `LLM_MODEL` | No | Model name (default: gpt-4o) |
| `ELEVENLABS_API_KEY` | No | ElevenLabs key for voice calls |
| `ELEVENLABS_VOICE_ID` | No | Custom TTS voice (default: Rachel) |
| `FINNHUB_API_KEY` | No | Finnhub API for news data |
| `MARKETAUX_API_KEY` | No | MarketAux API for news data |
| `PORT` | No | Backend port (default: 3001) |

---

## Troubleshooting

**Backend won't connect to MCP server**
- Ensure `uv` is installed: `which uv`
- Verify Alpaca keys are set: `echo $ALPACA_API_KEY`
- Test MCP server manually: `cd alpaca-mcp-server && uv run alpaca-mcp-server serve`

**LLM not responding**
- Check that `LLM_PROVIDER` and the corresponding API key are set
- Verify the model name is valid for your provider
- Backend falls back to manual parsing if no LLM is configured

**Voice calls not working**
- Ensure `ELEVENLABS_API_KEY` is set in the `.env` file
- Check browser microphone permissions
- The WebSocket proxy must be configured (Vite proxies `/ws` to backend automatically)

**Charts not loading**
- Yahoo Finance data may have rate limits; retry after a moment
- Check backend logs for chart endpoint errors

---

## License

MIT
