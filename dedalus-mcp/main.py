# main.py (repo root)
import os
import sys

def main() -> None:
    """
    Dedalus typically boots servers via: `uv run main`
    We forward that to Alpaca's CLI: `alpaca-mcp-server serve`
    and default to an HTTP transport suitable for hosted use.
    """
    host = os.getenv("HOST", "0.0.0.0")
    port = os.getenv("PORT", "8000")

    # Allow overrides if you want to run stdio locally
    transport = os.getenv("MCP_TRANSPORT", "streamable-http")

    # Import the Alpaca CLI entrypoint
    # (exact function name may differ; adjust to whatever Alpaca exposes)
    from alpaca_mcp_server.cli import main as alpaca_cli_main

    sys.argv = [
        "alpaca-mcp-server",
        "serve",
        "--transport",
        transport,
        "--host",
        host,
        "--port",
        str(port),
    ]

    alpaca_cli_main()

if __name__ == "__main__":
    main()

