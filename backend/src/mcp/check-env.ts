import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export function checkEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for uvx command
  try {
    execSync('which uvx', { stdio: 'ignore' });
  } catch {
    errors.push('uvx command not found. Please install uv: https://docs.astral.sh/uv/getting-started/installation/');
  }

  // Check for API keys AFTER trying to load from .env file
  // (We'll check again after loading .env)

  // Check if .env file exists in alpaca-mcp-server directory
  // Try multiple possible paths
  const possiblePaths = [
    path.join(__dirname, '../../alpaca-mcp-server/.env'), // From compiled dist
    path.join(__dirname, '../../../alpaca-mcp-server/.env'), // From src
    path.join(process.cwd(), '../alpaca-mcp-server/.env'), // From backend directory
    path.join(process.cwd(), 'alpaca-mcp-server/.env'), // If running from root
  ];

  let envPath: string | null = null;
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      envPath = possiblePath;
      break;
    }
  }

  if (envPath) {
    console.log(`Found .env file at: ${envPath}`);
    // Try to load it
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const envVars = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      let loadedKeys = 0;
      for (const line of envVars) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          if (key.trim() === 'ALPACA_API_KEY' && !process.env.ALPACA_API_KEY) {
            process.env.ALPACA_API_KEY = value;
            loadedKeys++;
          }
          if (key.trim() === 'ALPACA_SECRET_KEY' && !process.env.ALPACA_SECRET_KEY) {
            process.env.ALPACA_SECRET_KEY = value;
            loadedKeys++;
          }
          if (key.trim() === 'ALPACA_PAPER_TRADE' && !process.env.ALPACA_PAPER_TRADE) {
            process.env.ALPACA_PAPER_TRADE = value;
          }
          // Load LLM configuration
          if (key.trim() === 'LLM_PROVIDER' && !process.env.LLM_PROVIDER) {
            process.env.LLM_PROVIDER = value;
          }
          if (key.trim() === 'DEDALUS_API_KEY' && !process.env.DEDALUS_API_KEY) {
            process.env.DEDALUS_API_KEY = value;
          }
          if (key.trim() === 'OPENAI_API_KEY' && !process.env.OPENAI_API_KEY) {
            process.env.OPENAI_API_KEY = value;
          }
          if (key.trim() === 'ANTHROPIC_API_KEY' && !process.env.ANTHROPIC_API_KEY) {
            process.env.ANTHROPIC_API_KEY = value;
          }
          if (key.trim() === 'LLM_MODEL' && !process.env.LLM_MODEL) {
            process.env.LLM_MODEL = value;
          }
        }
      }
      if (loadedKeys > 0) {
        console.log(`Loaded ${loadedKeys} API key(s) from .env file`);
      }
    } catch (err) {
      console.warn('Failed to read .env file:', err);
    }
  } else {
    console.log('No .env file found. Checked paths:', possiblePaths);
  }

  // Now check for API keys (after potentially loading from .env)
  if (!process.env.ALPACA_API_KEY) {
    errors.push('ALPACA_API_KEY environment variable is not set');
  }

  if (!process.env.ALPACA_SECRET_KEY) {
    errors.push('ALPACA_SECRET_KEY environment variable is not set');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
