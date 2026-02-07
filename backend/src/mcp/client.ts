import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPToolCall } from '../types';
import { spawn } from 'child_process';
import { checkEnvironment } from './check-env';

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isInitialized = false;
  private process: ReturnType<typeof spawn> | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Check environment and load .env file if needed
    const envCheck = checkEnvironment();
    if (!envCheck.valid) {
      const errorMsg = `Environment check failed:\n${envCheck.errors.join('\n')}\n\nPlease set ALPACA_API_KEY and ALPACA_SECRET_KEY environment variables or create a .env file in the alpaca-mcp-server directory.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Check for required environment variables
    const apiKey = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;

    if (!apiKey || !secretKey) {
      const errorMsg = 'Missing required environment variables: ALPACA_API_KEY and ALPACA_SECRET_KEY must be set';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      console.log('Initializing MCP client...');
      console.log('Command: uvx alpaca-mcp-server serve');

      // Create transport - this will spawn the process
      this.transport = new StdioClientTransport({
        command: 'uvx',
        args: ['alpaca-mcp-server', 'serve'],
        env: {
          ...process.env,
          ALPACA_API_KEY: apiKey,
          ALPACA_SECRET_KEY: secretKey,
          ALPACA_PAPER_TRADE: process.env.ALPACA_PAPER_TRADE || 'True',
        },
      });

      // Create client
      this.client = new Client(
        {
          name: 'alpaca-mcp-backend',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Set up error handlers before connecting
      if (this.transport && 'process' in this.transport) {
        const proc = (this.transport as any).process;
        if (proc) {
          proc.stderr?.on('data', (data: Buffer) => {
            console.error('MCP server stderr:', data.toString());
          });
          proc.stdout?.on('data', (data: Buffer) => {
            console.log('MCP server stdout:', data.toString());
          });
          proc.on('error', (error: Error) => {
            console.error('MCP server process error:', error);
          });
          proc.on('exit', (code: number | null, signal: string | null) => {
            console.error(`MCP server process exited with code ${code}, signal ${signal}`);
            this.isInitialized = false;
          });
        }
      }

      // Connect to the server with timeout
      const connectPromise = this.client.connect(this.transport);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000);
      });

      await Promise.race([connectPromise, timeoutPromise]);

      this.isInitialized = true;
      console.log('MCP client initialized successfully');
    } catch (error: any) {
      console.error('Failed to initialize MCP client:', error);
      if (error.message) {
        console.error('Error message:', error.message);
      }
      this.isInitialized = false;
      this.client = null;
      this.transport = null;
      throw error;
    }
  }

  async callTool(toolCall: MCPToolCall): Promise<string> {
    if (!this.isInitialized || !this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    // Log tool call with parameters
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔧 MCP Tool Call: ${toolCall.name}`);
    console.log(`📋 Parameters:`, JSON.stringify(toolCall.arguments || {}, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const result = await this.client.callTool({
        name: toolCall.name,
        arguments: toolCall.arguments || {},
      });

      // Extract text content from the result
      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const textContent = result.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('\n');

        // Log result summary (truncate if too long)
        const resultPreview = textContent.length > 500 
          ? textContent.substring(0, 500) + '...' 
          : textContent;
        console.log(`✅ Tool Result (${textContent.length} chars):`, resultPreview.substring(0, 200));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        return textContent || JSON.stringify(result.content);
      }

      const jsonResult = JSON.stringify(result);
      console.log(`✅ Tool Result:`, jsonResult.substring(0, 200));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return jsonResult;
    } catch (error) {
      console.error(`❌ Error calling tool ${toolCall.name}:`, error);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      throw error;
    }
  }

  async listTools(): Promise<string[]> {
    if (!this.isInitialized || !this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    try {
      const tools = await this.client.listTools();
      return tools.tools.map((tool) => tool.name);
    } catch (error) {
      console.error('Error listing tools:', error);
      throw error;
    }
  }

  async getToolSchemas(): Promise<Array<{
    name: string;
    description: string;
    inputSchema: any;
  }>> {
    if (!this.isInitialized || !this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    try {
      const tools = await this.client.listTools();
      return tools.tools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || {},
      }));
    } catch (error) {
      console.error('Error getting tool schemas:', error);
      throw error;
    }
  }

  async completePrompt(prompt: string, args?: Record<string, any>): Promise<string> {
    if (!this.isInitialized || !this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    try {
      // Try to use MCP's prompt completion if available
      // Note: This method may not be available on all MCP clients
      const clientAny = this.client as any;
      if (typeof clientAny.completePrompt === 'function') {
        const result = await clientAny.completePrompt({
          name: 'default',
          arguments: {
            prompt,
            ...args,
          },
        });

        if (result.content && Array.isArray(result.content) && result.content.length > 0) {
          const textContent = result.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join('\n');
          return textContent || JSON.stringify(result.content);
        }

        return JSON.stringify(result);
      } else {
        throw new Error('Prompt completion not supported by MCP client');
      }
    } catch (error: any) {
      // If prompt completion is not available, fall back to tool calling
      // This is a simple fallback - in practice, you'd want to use an LLM service
      // to interpret the message and call the appropriate tool
      console.warn('Prompt completion not available, falling back to direct tool call:', error.message);
      throw new Error('Natural language interpretation requires an LLM service. Please use specific tool calls.');
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.error('Error disconnecting MCP client:', error);
      }
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    this.client = null;
    this.transport = null;
    this.isInitialized = false;
  }

  // Reset connection - useful for retrying after errors
  async reset(): Promise<void> {
    await this.disconnect();
    this.isInitialized = false;
  }
}

// Singleton instance
let mcpClientInstance: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient();
  }
  return mcpClientInstance;
}
