# tracker/utils/codechef_api.py
"""
CodeChef data fetcher — NO API KEY REQUIRED.

The official CodeChef API v2 stopped accepting new applications.
This module scrapes the public CodeChef profile page using only
the `requests` library (already in your project).

What it fetches:
  - Full contest rating history (from the embedded JSON in the profile page)
  - Current rating (fallback if JSON not found)

Results are cached in Redis for 1 hour (same as before).
"""

import re
import json
import logging
import requests
from datetime import datetime
from django.core.cache import cache

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def fetch_codechef_contest_history(username: str) -> list[dict]:
    """
    Returns list of dicts:
      [{"contest": str, "rank": int, "old_rating": int,
        "new_rating": int, "date": "YYYY-MM-DD HH:MM:SS"}, ...]

    Cached in Redis for 1 hour.
    """
    cache_key = f"codechef_history_{username}"
    cached = cache.get(cache_key)
    if cached is not None:
        logger.debug(f"CodeChef cache hit: {username}")
        return cached

    result = _scrape_history(username)
    cache.set(cache_key, result, timeout=3600)
    return result


def _scrape_history(username: str) -> list[dict]:
    """Scrape the CodeChef public profile page for contest history."""
    url = f"https://www.codechef.com/users/{username}"
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=15)
        if resp.status_code == 404:
            logger.warning(f"CodeChef user not found: {username}")
            return []
        if resp.status_code != 200:
            logger.error(f"CodeChef HTTP {resp.status_code} for {username}")
            return _fallback_current_rating(username)

        html = resp.text

        # ── Method 1: Extract from the embedded JSON (most reliable) ──────
        # CodeChef embeds rating history in a <script> block as JSON
        history = _extract_from_json_script(html, username)
        if history:
            logger.info(f"CodeChef JSON method: {len(history)} contests for {username}")
            return history

        # ── Method 2: Extract from the graph data array ────────────────────
        history = _extract_from_graph_data(html, username)
        if history:
            logger.info(f"CodeChef graph method: {len(history)} contests for {username}")
            return history

        # ── Method 3: Current rating only ─────────────────────────────────
        return _fallback_current_rating(username, html)

    except requests.Timeout:
        logger.error(f"CodeChef timeout for {username}")
        return []
    except Exception as e:
        logger.error(f"CodeChef scrape error for {username}: {e}")
        return []


def _extract_from_json_script(html: str, username: str) -> list[dict]:
    """
    CodeChef embeds data like:
      var rating_data = [{"code":"COOK...", "name":"...", "end_date":"...",
                          "rating":"1500", "rank":"23"}, ...]
    """
    patterns = [
        r'var\s+rating_data\s*=\s*(\[.*?\])\s*;',
        r'"ratingHistory"\s*:\s*(\[.*?\])',
        r'var\s+all_rating\s*=\s*(\[.*?\])\s*;',
    ]
    for pattern in patterns:
        m = re.search(pattern, html, re.DOTALL)
        if not m:
            continue
        try:
            data = json.loads(m.group(1))
            return _parse_codechef_entries(data)
        except (json.JSONDecodeError, ValueError):
            continue
    return []


def _extract_from_graph_data(html: str, username: str) -> list[dict]:
    """
    Fall back: look for Highcharts-style series data embedded in the page.
    Pattern: [[timestamp_ms, rating], ...]
    """
    # Look for contest name list + rating list separately
    names_m  = re.search(r'contestName\s*[=:]\s*(\[.*?\])', html, re.DOTALL)
    rating_m = re.search(r'contestRating\s*[=:]\s*(\[.*?\])', html, re.DOTALL)
    date_m   = re.search(r'contestDate\s*[=:]\s*(\[.*?\])', html, re.DOTALL)
    rank_m   = re.search(r'contestRank\s*[=:]\s*(\[.*?\])', html, re.DOTALL)

    if not names_m or not rating_m:
        return []
    try:
        names   = json.loads(names_m.group(1))
        ratings = json.loads(rating_m.group(1))
        dates   = json.loads(date_m.group(1))  if date_m  else []
        ranks   = json.loads(rank_m.group(1))  if rank_m  else []

        result = []
        prev_rating = 0
        for i, name in enumerate(names):
            new_rating = int(ratings[i]) if i < len(ratings) else 0
            rank       = int(ranks[i])   if i < len(ranks)   else 0
            date_str   = dates[i]        if i < len(dates)   else ""
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
            except (ValueError, TypeError):
                dt = datetime.utcnow()
            result.append({
                "contest":    name,
                "rank":       rank,
                "old_rating": prev_rating,
                "new_rating": new_rating,
                "date":       dt.strftime("%Y-%m-%d %H:%M:%S"),
            })
            prev_rating = new_rating
        return result
    except Exception:
        return []


def _parse_codechef_entries(data: list) -> list[dict]:
    """Convert raw CodeChef JSON entries to our standard format."""
    result = []
    prev_rating = 0
    for entry in data:
        try:
            new_rating = int(entry.get("rating", 0) or entry.get("new_rating", 0) or 0)
            rank       = int(entry.get("rank",   0) or 0)

            # Date: CodeChef uses "end_date" like "2023-12-03 14:30:00"
            date_str = (entry.get("end_date") or entry.get("date") or
                        entry.get("endDate") or "")
            try:
                # Handle ISO with timezone offset
                clean = date_str.replace("T", " ")[:19]
                dt    = datetime.strptime(clean, "%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError):
                dt = datetime.utcnow()

            contest = (entry.get("name") or entry.get("code") or
                       entry.get("contest") or "Unknown Contest")

            result.append({
                "contest":    contest,
                "rank":       rank,
                "old_rating": int(entry.get("old_rating", prev_rating) or prev_rating),
                "new_rating": new_rating,
                "date":       dt.strftime("%Y-%m-%d %H:%M:%S"),
            })
            prev_rating = new_rating
        except (ValueError, TypeError, KeyError):
            continue
    return result


def _fallback_current_rating(username: str, html: str = "") -> list[dict]:
    """
    Last resort: extract only the current rating from the profile page.
    Returns a single synthetic entry so the user sees *something*.
    """
    rating = 0
    if html:
        # Try several patterns CodeChef has used over time
        for pat in [
            r'"rating"\s*:\s*"?(\d+)"?',
            r'class="rating"[^>]*>\s*(\d+)',
            r'<span[^>]+rating[^>]*>\s*(\d+)',
        ]:
            m = re.search(pat, html)
            if m:
                rating = int(m.group(1))
                break

    if not html:
        # Try a fresh request
        try:
            r = requests.get(
                f"https://www.codechef.com/users/{username}",
                headers=_HEADERS, timeout=12
            )
            for pat in [r'"rating"\s*:\s*"?(\d+)"?', r'class="rating"[^>]*>\s*(\d+)']:
                m = re.search(pat, r.text)
                if m:
                    rating = int(m.group(1))
                    break
        except Exception:
            pass

    if rating:
        return [{
            "contest":    "Latest Rating",
            "rank":       0,
            "old_rating": 0,
            "new_rating": rating,
            "date":       datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        }]
    return []


# ─── Async wrapper ────────────────────────────────────────────────────────────

async def fetch_codechef_async(username: str) -> list[dict]:
    import asyncio
    return await asyncio.to_thread(fetch_codechef_contest_history, username)
