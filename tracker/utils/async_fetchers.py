# tracker/utils/async_fetchers.py
"""
Async platform fetchers.

IMPORTANT: This module no longer resolves handles from UserProfile.
Handle resolution is the sole responsibility of fetch_coordinator.py,
which passes resolved handles as explicit keyword arguments.
This keeps fetchers pure — they fetch, parse, and return data only.
"""
import asyncio
import aiohttp
from datetime import datetime
from tracker.utils.codechef_api import fetch_codechef_async
from tracker.utils.atcoder import fetch_atcoder_async


async def fetch_codeforces(http_session, handle):
    url = f"https://codeforces.com/api/user.rating?handle={handle}"
    try:
        async with http_session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()
            if data["status"] != "OK":
                return []
            return data["result"]
    except Exception as e:
        print(f"Codeforces error ({handle}): {e}")
        return []


async def fetch_leetcode_solved(http_session, handle):
    url = "https://leetcode.com/graphql/"
    query = {
        "query": """query getUserProfile($username: String!) {
            matchedUser(username: $username) {
                submitStats: submitStatsGlobal { acSubmissionNum { difficulty count } }
            }
        }""",
        "variables": {"username": handle}
    }
    headers = {
        "Content-Type": "application/json",
        "Referer": f"https://leetcode.com/{handle}/",
        "User-Agent": "Mozilla/5.0"
    }
    try:
        async with http_session.post(url, json=query, headers=headers,
                                     timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                return 0
            data = await resp.json()
            mu = data.get("data", {}).get("matchedUser")
            if not mu:
                return 0
            all_entry = next(
                (i for i in mu["submitStats"]["acSubmissionNum"] if i["difficulty"] == "All"),
                None
            )
            return all_entry["count"] if all_entry else 0
    except Exception as e:
        print(f"LeetCode solved error ({handle}): {e}")
        return 0


async def fetch_leetcode(http_session, handle, include_non_attended=False):
    url = "https://leetcode.com/graphql/"
    query = {
        "operationName": "userContestRankingInfo",
        "query": """query userContestRankingInfo($username: String!) {
            userContestRankingHistory(username: $username) {
                attended rating ranking
                contest { title startTime }
            }
        }""",
        "variables": {"username": handle}
    }
    headers = {
        "Content-Type": "application/json",
        "Referer": f"https://leetcode.com/{handle}/",
        "User-Agent": "Mozilla/5.0"
    }
    try:
        async with http_session.post(url, json=query, headers=headers,
                                     timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                return await fetch_leetcode_solved(http_session, handle), []
            data = await resp.json()
            if "errors" in data or not data.get("data"):
                return await fetch_leetcode_solved(http_session, handle), []

            history = []
            for e in data["data"].get("userContestRankingHistory", []):
                if not e["attended"] and not include_non_attended:
                    continue
                dt = datetime.fromtimestamp(e["contest"]["startTime"])
                history.append({
                    "contest":    e["contest"]["title"],
                    "rank":       int(e.get("ranking", 0)),
                    "old_rating": 0,
                    "new_rating": int(e["rating"]),
                    "date":       dt.strftime("%Y-%m-%d %H:%M:%S"),
                })
            solved = await fetch_leetcode_solved(http_session, handle)
            return solved, history
    except Exception as e:
        print(f"LeetCode error ({handle}): {e}")
        return await fetch_leetcode_solved(http_session, handle), []


async def fetch_and_store_rating_history_async(
    username,
    cf_handle=None,
    lc_handle=None,
    cc_handle=None,
    ac_handle=None,
    include_atcoder=True,
):
    """
    Fetch from all four platforms concurrently using asyncio.gather().

    Handles are passed in explicitly by fetch_coordinator — this function
    no longer queries UserProfile itself. If handles are not passed
    (e.g. called directly in tests), username is used as fallback.

    Returns (history: list[RatingHistory], lc_solved: int).
    """
    # Fallback only if called without explicit handles (e.g. tests)
    cf_handle = cf_handle or username
    lc_handle = lc_handle or username
    cc_handle = cc_handle or username
    ac_handle = ac_handle or username

    print(f"[async] fetching — CF:{cf_handle} LC:{lc_handle} CC:{cc_handle} AC:{ac_handle}")

    async with aiohttp.ClientSession() as session:
        cf_task = fetch_codeforces(session, cf_handle)
        cc_task = fetch_codechef_async(cc_handle)
        lc_task = fetch_leetcode(session, lc_handle)
        ac_task = (fetch_atcoder_async(ac_handle)
                   if include_atcoder
                   else asyncio.sleep(0, result=([], 0)))

        cf_data, cc_data, (lc_solved, lc_hist), (ac_hist, _) = await asyncio.gather(
            cf_task, cc_task, lc_task, ac_task
        )

    from tracker.models import RatingHistory
    history = []

    for e in cf_data:
        try:
            dt = datetime.fromtimestamp(e["ratingUpdateTimeSeconds"])
            history.append(RatingHistory(
                platform="Codeforces", contest=e["contestName"],
                rank=e["rank"], old_rating=e["oldRating"], new_rating=e["newRating"],
                date=dt, change=e["newRating"] - e["oldRating"]
            ))
        except (KeyError, ValueError):
            pass

    for e in cc_data:
        try:
            dt = datetime.strptime(e["date"], "%Y-%m-%d %H:%M:%S")
            history.append(RatingHistory(
                platform="CodeChef", contest=e["contest"],
                rank=e["rank"], old_rating=e["old_rating"], new_rating=e["new_rating"],
                date=dt, change=e["new_rating"] - e["old_rating"]
            ))
        except (KeyError, ValueError):
            pass

    for e in lc_hist:
        try:
            dt = datetime.strptime(e["date"], "%Y-%m-%d %H:%M:%S")
            history.append(RatingHistory(
                platform="LeetCode", contest=e["contest"],
                rank=e["rank"], old_rating=0, new_rating=e["new_rating"],
                date=dt, change=0
            ))
        except (KeyError, ValueError):
            pass

    if include_atcoder:
        for e in ac_hist:
            try:
                dt = datetime.strptime(e["date"], "%Y-%m-%d %H:%M:%S")
                history.append(RatingHistory(
                    platform="AtCoder", contest=e["contest"],
                    rank=e["rank"], old_rating=e["old_rating"], new_rating=e["new_rating"],
                    date=dt, change=e["change"]
                ))
            except (KeyError, ValueError):
                pass

    return history, lc_solved
