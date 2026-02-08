import express from 'express';
import cors from 'cors';
import * as http from 'http';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import accountRoutes from './routes/account';
import positionsRoutes from './routes/positions';
import ordersRoutes from './routes/orders';
import chatRoutes from './routes/chat';
import chartRoutes from './routes/chart';
import newsRoutes from './routes/news';
import portfolioRoutes from './routes/portfolio';
import ttsRoutes from './routes/tts';
import { handleSttWebSocket } from './ws/stt';

// Load .env file - prioritize root, then backend, then alpaca-mcp-server
const rootEnvPath = path.join(__dirname, '../../.env');
const backendEnvPath = path.join(__dirname, '../.env');
const alpacaEnvPath = path.join(__dirname, '../../alpaca-mcp-server/.env');
const fs = require('fs');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else if (fs.existsSync(alpacaEnvPath)) {
  dotenv.config({ path: alpacaEnvPath });
} else {
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/account', accountRoutes);
app.use('/api/positions', positionsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chart', chartRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/tts', ttsRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

const httpServer = http.createServer(app);
httpServer.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

// WebSocket server for /ws/stt
const wss = new WebSocketServer({ noServer: true });
httpServer.on('upgrade', (request, socket, head) => {
  const url = request.url ?? '';
  if (url.startsWith('/ws/stt')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, url);
    });
  } else {
    socket.destroy();
  }
});
wss.on('connection', (ws: import('ws').WebSocket, req: import('http').IncomingMessage) => {
  handleSttWebSocket(ws, req.url ?? '');
});

const server = httpServer;
// Set server timeout to prevent socket hang ups
// Increased timeout for LLM requests that may include web searches
server.timeout = 120000; // 120 seconds (2 minutes)
server.keepAliveTimeout = 180000; // 180 seconds (3 minutes)
server.headersTimeout = 181000; // 181 seconds (slightly higher than keepAliveTimeout)
