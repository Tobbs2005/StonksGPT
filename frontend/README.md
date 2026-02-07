# Alpaca MCP Frontend

React frontend with shadcn UI components for interacting with the Alpaca MCP server.

## Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Run the development server:
```bash
npm run dev
```

The frontend will start on `http://localhost:3000` and proxy API requests to the backend.

## Features

- **Chat Interface**: Natural language interaction with MCP tools
- **Sidebar**: 
  - Account information (balance, buying power, equity)
  - Positions list with P/L indicators
- **Auto-refresh**: Positions and account info refresh every 30 seconds
- **Responsive Design**: Mobile-friendly with collapsible sidebar
- **Dark Mode**: Toggle between light and dark themes

## Usage

1. Start the backend server first (see `backend/README.md`)
2. Start this frontend server
3. Open `http://localhost:3000` in your browser
4. Use the chat interface to interact with your Alpaca account

## Example Commands

- "Show my account balance"
- "What are my positions?"
- "Get position for AAPL"
- "Show my orders"
