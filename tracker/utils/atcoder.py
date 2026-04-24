# tracker/utils/atcoder.py
"""
AtCoder platform support — new in this upgrade.
Uses the public AtCoder Problems API (no key needed).

Endpoints used:
  https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions
  https://kenkoooo.com/atcoder/atcoder-api/v3/user/rating?user=<handle>

The AtCoder Problems API (kenkoooo) is community-maintained and open.
Respect their rate-limit: https://github.com/kenkoooo/AtCoderProblems
"""

import logging
import requests
from datetime import datetime
from django.core.cache import cache

logger = logging.getLogger(__name__)

_BASE  = "https://kenkoooo.com/atcoder/atcoder-api/v3"
_BASE2 = "https://atcoder.jp/users"


def fetch_atcoder_history(username: str) -> tuple[list, int]:
    """
    Returns (rating_history_list, total_ac_count).

    rating_history_list entries are dicts:
      {"platform": "AtCoder", "contest": str, "rank": int,
       "old_rating": int, "new_rating": int,
       "date": "YYYY-MM-DD HH:MM:SS", "change": int}
    """
    cache_key = f"atcoder_history_{username}"
    cached    = cache.get(cache_key)
    if cached is not None:
        return cached

    history = _fetch_rating_history(username)
    ac_count = _fetch_ac_count(username)

    result = (history, ac_count)
    cache.set(cache_key, result, timeout=3600)
    return result


def _fetch_rating_history(username: str) -> list[dict]:
    """Fetch contest rating history from kenkoooo API."""
    try:
        r = requests.get(
            "https://atcoder.jp/users/{}/history/json".format(username),
            headers={"User-Agent": "CodeCracker/2.0"},
            timeout=12,
        )
        if r.status_code == 200:
            data = r.json()
            return _parse_history(data, username)
    except Exception as e:
        logger.error(f"AtCoder rating history error for {username}: {e}")

    # Fallback: try kenkoooo rating endpoint
    try:
        r = requests.get(
            f"https://kenkoooo.com/atcoder/atcoder-api/v3/user/rating",
            params={"user": username},
            headers={"User-Agent": "CodeCracker/2.0"},
            timeout=12,
        )
        if r.status_code == 200:
            data = r.json()
            return _parse_history(data, username)
    except Exception as e:
        logger.error(f"AtCoder kenkoooo fallback error for {username}: {e}")

    return []


def _parse_history(data: list, username: str) -> list[dict]:
    """Parse raw AtCoder contest history JSON into our standard format."""
    if not isinstance(data, list):
        return []

    history = []
    prev_rating = 0

    for entry in data:
        try:
            # AtCoder history format varies slightly by source
            contest  = entry.get("ContestScreenName") or entry.get("contest", "Unknown")
            new_rat  = int(entry.get("NewRating", 0) or entry.get("rating", 0))
            old_rat  = int(entry.get("OldRating", 0) or prev_rating)
            rank     = int(entry.get("Place", 0) or entry.get("rank", 0))
            end_time = entry.get("EndTime") or entry.get("end_time", "")

            try:
                if isinstance(end_time, (int, float)):
                    dt = datetime.fromtimestamp(end_time)
                elif end_time:
                    # Try common ISO formats
                    for fmt in ("%Y-%m-%dT%H:%M:%S+09:00", "%Y-%m-%dT%H:%M:%S",
                                "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                        try:
                            dt = datetime.strptime(end_time[:19], fmt[:len(end_time[:19])])
                            break
                        except ValueError:
                            continue
                    else:
                        dt = datetime.utcnow()
                else:
                    dt = datetime.utcnow()
            except Exception:
                dt = datetime.utcnow()

            # Clean up contest name
            if "_" in contest and not contest.startswith("arc") and not contest.startswith("agc"):
                contest = contest.replace("_", " ").title()

            history.append({
                "platform":   "AtCoder",
                "contest":    contest,
                "rank":       rank,
                "old_rating": old_rat,
                "new_rating": new_rat,
                "date":       dt.strftime("%Y-%m-%d %H:%M:%S"),
                "change":     new_rat - old_rat,
            })
            prev_rating = new_rat

        except (ValueError, TypeError, KeyError) as e:
            logger.warning(f"AtCoder entry parse error: {e}")
            continue

    logger.info(f"AtCoder: parsed {len(history)} entries for {username}")
    return history


def _fetch_ac_count(username: str) -> int:
    """Fetch total accepted submission count."""
    try:
        r = requests.get(
            f"{_BASE}/user/ac_rank",
            params={"user": username},
            headers={"User-Agent": "CodeCracker/2.0"},
            timeout=8,
        )
        if r.status_code == 200:
            data = r.json()
            return int(data.get("count", 0))
    except Exception as e:
        logger.error(f"AtCoder AC count error for {username}: {e}")
    return 0


def get_atcoder_current_rating(username: str) -> int:
    """Return just the current AtCoder rating (highest new_rating in history)."""
    history, _ = fetch_atcoder_history(username)
    if history:
        return max((h["new_rating"] for h in history), default=0)
    return 0


# ─── Async wrapper ────────────────────────────────────────────────────────────

async def fetch_atcoder_async(username: str) -> tuple[list, int]:
    import asyncio
    return await asyncio.to_thread(fetch_atcoder_history, username)
