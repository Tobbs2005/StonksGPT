# Alpaca MCP Trading Dashboard

A full-stack web application for interacting with the Alpaca Trading API through the Model Context Protocol (MCP).

## Architecture

- **Backend**: Express.js server that wraps the Alpaca MCP server and exposes REST endpoints
- **Frontend**: React application with shadcn UI components featuring a chat interface and trading dashboard

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+ with `uv` installed
- Alpaca API credentials (get them from [Alpaca Dashboard](https://app.alpaca.markets/paper/dashboard/overview))

### Setup

1. **Configure Alpaca MCP Server** (if not already done):
```bash
cd alpaca-mcp-server
uvx alpaca-mcp-server init
```

2. **Set up Backend**:
```bash
cd backend
npm install
export ALPACA_API_KEY="your_api_key"
export ALPACA_SECRET_KEY="your_secret_key"
npm run dev
```

3. **Set up Frontend** (in a new terminal):
```bash
cd frontend
npm install
npm run dev
```

4. **Open the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Project Structure

```
TradeBot/
├── alpaca-mcp-server/    # Python MCP server (existing)
├── backend/              # Express.js REST API
│   └── src/
│       ├── mcp/         # MCP client wrapper
│       └── routes/       # REST route handlers
└── frontend/            # React application
    └── src/
        ├── components/  # React components
        └── lib/         # API client
```

## Features

- **Chat Interface**: Natural language interaction with trading operations
- **Real-time Positions**: View all open positions with P/L
- **Account Dashboard**: Monitor account balance, buying power, and equity
- **Order Management**: Place and manage stock, crypto, and option orders
- **Auto-refresh**: Positions and account info update every 30 seconds
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Mode**: Toggle between light and dark themes

## Development

See individual README files in `backend/` and `frontend/` directories for more details.

## License

MIT
