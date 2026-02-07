# Alpaca MCP Backend

Express.js backend that wraps the Alpaca MCP server and exposes REST endpoints.

## Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Set up environment variables (choose one method):

**Method 1: Environment variables**
```bash
export ALPACA_API_KEY="your_api_key"
export ALPACA_SECRET_KEY="your_secret_key"
export ALPACA_PAPER_TRADE="True"  # or "False" for live trading
```

**Method 2: .env file (recommended)**
Create a `.env` file in the **root directory** of the project (recommended) or in the `alpaca-mcp-server` directory:
```bash
# In the root directory (TradeBot/.env) - RECOMMENDED
ALPACA_API_KEY=your_api_key
ALPACA_SECRET_KEY=your_secret_key
ALPACA_PAPER_TRADE=True

# Optional: LLM configuration
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
LLM_MODEL=gpt-4
```

The backend will automatically try to load from the root `.env` file first, then fall back to `alpaca-mcp-server/.env` if not found.

3. (Optional) Configure LLM Provider for Natural Language Processing:

The backend supports LLM-powered natural language understanding for chat messages. Configure one of the following providers:

**Option A: OpenAI**
```bash
export LLM_PROVIDER="openai"
export OPENAI_API_KEY="your_openai_api_key"
export LLM_MODEL="gpt-4"  # or "gpt-3.5-turbo", etc.
```

**Option B: Anthropic Claude**
```bash
export LLM_PROVIDER="anthropic"
export ANTHROPIC_API_KEY="your_anthropic_api_key"
export LLM_MODEL="claude-3-opus-20240229"  # or other Claude models
```

**Option C: Dedalus Labs**
```bash
export LLM_PROVIDER="dedalus"
export DEDALUS_API_KEY="your_dedalus_api_key"
export LLM_MODEL="gpt-4"  # or other models supported by Dedalus
```

You can also add these to the root `.env` file (or `alpaca-mcp-server/.env`). If no LLM provider is configured, the backend will fall back to manual regex-based parsing.

3. Run the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3001`.

## API Endpoints

- `GET /api/account` - Get account information
- `GET /api/positions` - Get all positions
- `GET /api/positions/:symbol` - Get specific position
- `POST /api/positions/:symbol/close` - Close a position
- `GET /api/orders` - Get orders
- `POST /api/orders/stock` - Place stock order
- `POST /api/orders/crypto` - Place crypto order
- `POST /api/orders/option` - Place option order
- `DELETE /api/orders/:id` - Cancel order
- `POST /api/chat/tool` - Generic MCP tool caller
- `POST /api/chat/message` - Natural language message endpoint (uses LLM if configured)
- `GET /api/chat/tools` - List available tools

## Requirements

- Node.js 18+
- Python 3.10+ with `uv` installed
- Alpaca API credentials
- `uvx` command available in PATH (install `uv` to get `uvx`)

## Troubleshooting

**Error: "Connection closed" or "MCP error -32000"**
- Make sure `uvx` is installed and available: `which uvx`
- Verify API keys are set: `echo $ALPACA_API_KEY`
- Check if the MCP server can start manually: `uvx alpaca-mcp-server serve`
- Ensure the `.env` file exists in the root directory (or `alpaca-mcp-server/` directory) if using that method

**Error: "Missing required environment variables"**
- Set `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` environment variables
- Or create a `.env` file in the root directory (or `alpaca-mcp-server` directory)

**LLM Features Not Working**
- Ensure you've installed LLM dependencies: `npm install`
- Verify your LLM provider API key is set correctly
- Check that `LLM_PROVIDER` is set to one of: `openai`, `anthropic`, or `dedalus`
- The backend will fall back to manual parsing if LLM is not configured
