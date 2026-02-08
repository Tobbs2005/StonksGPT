# Alpaca MCP Trading Dashboard

A full-stack trading and portfolio management application that combines real-time market data, AI-assisted insights, and safe trade execution using the Alpaca Trading API and Model Context Protocol (MCP).

The platform allows users to track portfolios, analyze stock performance, stay updated with market news, and execute trades through a modern dashboard with optional natural-language interaction.

---

## What This App Does

- Displays live stock price charts and historical performance
- Surfaces relevant stock and market news to inform trading decisions
- Tracks user portfolios, positions, and investment allocation
- Enables users to buy and sell assets through Alpaca’s trading API
- Provides a personalized account side panel with balances, buying power, and account metadata
- Supports dark mode and responsive layouts for desktop and mobile use

---

## Architecture Overview

The system is designed with a clear separation between AI tooling, backend logic, and frontend presentation.

### Backend
- Node.js (Express) REST API serving as the application control layer
- Wraps a Python-based Alpaca MCP server to safely execute structured trading actions
- Integrates with a database to persist user state, portfolios, and session data
- Validates and routes requests between the frontend, LLM, and Alpaca API

### AI Layer
- Uses the Gemini API to interpret natural-language queries and extract structured trading intents
- LLM outputs are validated and constrained before any trading action is executed

### Frontend
- React application built with modern component patterns and shadcn UI
- Trading dashboard with charts, portfolio views, and order management
- Chat interface for AI-assisted queries and actions
- Account side panel for user and portfolio information
- Light/dark mode toggle and responsive design

---

## Tech Stack

- Frontend: React, shadcn UI
- Backend: Node.js (Express)
- AI: Gemini API
- Protocol: Python Model Context Protocol (MCP)
- Trading API: Alpaca (paper trading)
- Database: Supabase

---

## Features

- Portfolio tracking with holdings, allocations, and unrealized P/L
- Market data visualization with interactive stock charts
- Stock and market news feed
- AI-assisted natural-language interaction
- Order placement and management via Alpaca API
- Account dashboard with balances and buying power
- Automatic data refresh
- Dark mode support
- Responsive UI for desktop and mobile devices

---

## Project Structure
TradeBot/
├── alpaca-mcp-server/ # Python MCP server
├── backend/ # Express.js REST API
│ └── src/
│ ├── mcp/ # MCP client and tool wrappers
│ └── routes/ # API route handlers
└── frontend/ # React application
└── src/
├── components/ # UI components
└── lib/ # API and utility clients


---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- uv installed for Python environment management
- Alpaca API credentials (paper trading)

### Setup

1. Initialize the Alpaca MCP server:
```bash
cd alpaca-mcp-server
uvx alpaca-mcp-server init
```

2. Start the backend:
```bash
cd backend
npm install
export ALPACA_API_KEY="your_api_key"
export ALPACA_SECRET_KEY="your_secret_key"
npm run dev
```

3. Start the frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## Open the application:

Frontend: http://localhost:3000
Backend API: http://localhost:3001

---

---

## Notes:

The application uses paper trading by default
AI-generated actions are validated before execution
The architecture is designed to be extensible for additional agents and analytics

---

## License

MIT

---
