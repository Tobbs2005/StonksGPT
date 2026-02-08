"""
Brave Search Agent
==================
Structured web/news search using Dedalus Labs (AsyncDedalus + DedalusRunner)
with the Brave Search MCP server.

Returns typed JSON results with title, url, source, snippet, and published_at.

Usage:
    import asyncio
    from brave_search_agent import brave_search

    results = asyncio.run(brave_search("AMZN earnings news", mode="news"))
    for r in results["results"]:
        print(r["title"], r["url"])
"""

import json
import logging
import re
from typing import Any

from dedalus_labs import AsyncDedalus, DedalusRunner
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ── constants ────────────────────────────────────────────────────────────────

MODEL = "openai/gpt-5-nano"
MCP_SERVERS = ["tsion/brave-search-mcp"]
MAX_RESULTS = 10

# ── result schema ────────────────────────────────────────────────────────────

EMPTY_RESULT = {"title": "", "url": "", "source": "", "published_at": None, "snippet": ""}


def _sanitize_result(raw: dict[str, Any]) -> dict[str, Any]:
    """Ensure every field exists and has the correct type."""
    return {
        "title": str(raw.get("title") or ""),
        "url": str(raw.get("url") or ""),
        "source": str(raw.get("source") or raw.get("domain") or raw.get("publisher") or ""),
        "published_at": raw.get("published_at") or raw.get("publishedAt") or raw.get("date") or None,
        "snippet": str(raw.get("snippet") or raw.get("description") or ""),
    }


def _extract_json(text: str) -> Any:
    """
    Try to extract a JSON object from LLM output.
    Handles markdown code fences, leading/trailing junk, etc.
    """
    # Strip markdown code fences
    text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text.strip(), flags=re.MULTILINE)

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find the first { ... } or [ ... ] block
    for start_char, end_char in [("{", "}"), ("[", "]")]:
        start = text.find(start_char)
        if start == -1:
            continue
        # Find the matching closing bracket from the end
        end = text.rfind(end_char)
        if end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                continue

    return None


# ── main function ────────────────────────────────────────────────────────────

async def brave_search(
    query: str,
    *,
    mode: str = "web",
    limit: int = 8,
) -> dict[str, Any]:
    """
    Search the web using Brave Search via Dedalus MCP.

    Args:
        query:  The search query string.
        mode:   "web" for general results, "news" for recent news.
        limit:  Maximum number of results to return (capped at 10).

    Returns:
        {
            "query": "<original query>",
            "results": [
                {
                    "title": str,
                    "url": str,
                    "source": str,
                    "published_at": str | None,
                    "snippet": str,
                }
            ]
        }
    """
    limit = min(max(1, limit), MAX_RESULTS)

    mode_instruction = ""
    if mode == "news":
        mode_instruction = (
            "Focus on RECENT NEWS articles. Prefer results from the last 7 days. "
            "Use news-specific search if available. "
        )

    prompt = (
        f"Search for: {query}\n\n"
        f"{mode_instruction}"
        f"Use the brave-search-mcp tools to search the web.\n\n"
        f"Return ONLY valid JSON with NO markdown, NO commentary, NO explanation.\n"
        f"The JSON must follow this exact schema:\n"
        f'{{\n'
        f'  "query": "{query}",\n'
        f'  "results": [\n'
        f'    {{\n'
        f'      "title": "<page title>",\n'
        f'      "url": "<full URL>",\n'
        f'      "source": "<publisher or domain name>",\n'
        f'      "published_at": "<ISO 8601 date string or null>",\n'
        f'      "snippet": "<brief description or summary>"\n'
        f'    }}\n'
        f'  ]\n'
        f'}}\n\n'
        f"Return exactly {limit} results. "
        f"If fewer results are found, return as many as available. "
        f"Output ONLY the JSON object, nothing else."
    )

    try:
        client = AsyncDedalus()
        runner = DedalusRunner(client)

        logger.info("[brave-search-agent] Searching: %s (mode=%s, limit=%d)", query, mode, limit)

        result = await runner.run(
            input=prompt,
            model=MODEL,
            mcp_servers=MCP_SERVERS,
        )

        raw_output = result.final_output or ""
        logger.info("[brave-search-agent] Got %d chars from runner", len(raw_output))

        # Parse the JSON output
        parsed = _extract_json(raw_output)

        if parsed is None:
            logger.warning("[brave-search-agent] Failed to parse JSON from output: %s", raw_output[:300])
            return {"query": query, "results": []}

        # Handle case where parsed is a list (no wrapper object)
        if isinstance(parsed, list):
            parsed = {"query": query, "results": parsed}

        # Ensure top-level structure
        if not isinstance(parsed, dict):
            logger.warning("[brave-search-agent] Unexpected parsed type: %s", type(parsed))
            return {"query": query, "results": []}

        raw_results = parsed.get("results", [])
        if not isinstance(raw_results, list):
            raw_results = []

        # Sanitize each result
        results = [_sanitize_result(r) for r in raw_results if isinstance(r, dict)]

        # Enforce limit
        results = results[:limit]

        return {
            "query": parsed.get("query", query),
            "results": results,
        }

    except Exception as exc:
        logger.error("[brave-search-agent] Error during search: %s", exc, exc_info=True)
        return {"query": query, "results": []}


# ── usage example (not executed) ─────────────────────────────────────────────
#
#   import asyncio
#   from brave_search_agent import brave_search
#
#   async def main():
#       # General web search
#       web_results = await brave_search("top gold mining companies", limit=5)
#       print(json.dumps(web_results, indent=2))
#
#       # News-focused search
#       news_results = await brave_search("AMZN earnings news", mode="news", limit=8)
#       for article in news_results["results"]:
#           print(f"[{article['source']}] {article['title']}")
#           print(f"  {article['url']}")
#           print(f"  {article['snippet'][:100]}...")
#           print()
#
#   asyncio.run(main())
