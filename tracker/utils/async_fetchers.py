# tracker/utils/async_fetchers.py
"""
Upgraded:
  • Selenium replaced with codechef_api.py
  • AtCoder platform added (atcoder.py)
  • fetch_and_store_rating_history_async returns AtCoder history too
"""
import asyncio
import aiohttp
from datetime import datetime
from tracker.utils.codechef_api import fetch_codechef_async
from tracker.utils.atcoder import fetch_atcoder_async


async def fetch_codeforces(http_session, username):
    url = f"https://codeforces.com/api/user.rating?handle={username}"
    try:
        async with http_session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()
            if data["status"] != "OK":
                return []
            return data["result"]
    except Exception as e:
        print(f"Codeforces error ({username}): {e}")
        return []


async def fetch_leetcode_solved(http_session, username):
    url = "https://leetcode.com/graphql/"
    query = {
        "query": """query getUserProfile($username: String!) {
            matchedUser(username: $username) {
                submitStats: submitStatsGlobal { acSubmissionNum { difficulty count } }
            }
        }""",
        "variables": {"username": username}
    }
    headers = {
        "Content-Type": "application/json",
        "Referer": f"https://leetcode.com/{username}/",
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
        print(f"LeetCode solved error ({username}): {e}")
        return 0


async def fetch_leetcode(http_session, username, include_non_attended=False):
    url = "https://leetcode.com/graphql/"
    query = {
        "operationName": "userContestRankingInfo",
        "query": """query userContestRankingInfo($username: String!) {
            userContestRankingHistory(username: $username) {
                attended rating ranking
                contest { title startTime }
            }
        }""",
        "variables": {"username": username}
    }
    headers = {
        "Content-Type": "application/json",
        "Referer": f"https://leetcode.com/{username}/",
        "User-Agent": "Mozilla/5.0"
    }
    try:
        async with http_session.post(url, json=query, headers=headers,
                                     timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                return await fetch_leetcode_solved(http_session, username), []
            data = await resp.json()
            if "errors" in data or not data.get("data"):
                return await fetch_leetcode_solved(http_session, username), []

            history_data = data["data"].get("userContestRankingHistory", [])
            history = []
            for e in history_data:
                if not include_non_attended and not e["attended"]:
                    continue
                dt = datetime.fromtimestamp(e["contest"]["startTime"])
                history.append({
                    "contest":    e["contest"]["title"],
                    "rank":       int(e.get("ranking", 0)),
                    "old_rating": 0,
                    "new_rating": int(e["rating"]),
                    "date":       dt.strftime("%Y-%m-%d %H:%M:%S"),
                })
            solved = await fetch_leetcode_solved(http_session, username)
            return solved, history
    except Exception as e:
        print(f"LeetCode error ({username}): {e}")
        return await fetch_leetcode_solved(http_session, username), []


async def fetch_and_store_rating_history_async(username,
                                               include_atcoder=True):
    """
    Fetch from Codeforces, LeetCode, CodeChef (API), and AtCoder.
    Returns (history: list[RatingHistory], lc_solved: int).
    """
    print(f"[async] fetching rating history for {username}")
    async with aiohttp.ClientSession() as session:
        cf_task  = fetch_codeforces(session, username)
        cc_task  = fetch_codechef_async(username)
        lc_task  = fetch_leetcode(session, username)
        ac_task  = fetch_atcoder_async(username) if include_atcoder else asyncio.sleep(0, result=([], 0))

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
        except (KeyError, ValueError) as err:
            print(f"CF entry skip: {err}")

    for e in cc_data:
        try:
            dt = datetime.strptime(e["date"], "%Y-%m-%d %H:%M:%S")
            history.append(RatingHistory(
                platform="CodeChef", contest=e["contest"],
                rank=e["rank"], old_rating=e["old_rating"], new_rating=e["new_rating"],
                date=dt, change=e["new_rating"] - e["old_rating"]
            ))
        except (KeyError, ValueError) as err:
            print(f"CC entry skip: {err}")

    for e in lc_hist:
        try:
            dt = datetime.strptime(e["date"], "%Y-%m-%d %H:%M:%S")
            history.append(RatingHistory(
                platform="LeetCode", contest=e["contest"],
                rank=e["rank"], old_rating=0, new_rating=e["new_rating"],
                date=dt, change=0
            ))
        except (KeyError, ValueError) as err:
            print(f"LC entry skip: {err}")

    # AtCoder entries already have all fields
    for e in ac_hist:
        try:
            dt = datetime.strptime(e["date"], "%Y-%m-%d %H:%M:%S")
            history.append(RatingHistory(
                platform="AtCoder", contest=e["contest"],
                rank=e["rank"], old_rating=e["old_rating"], new_rating=e["new_rating"],
                date=dt, change=e["change"]
            ))
        except (KeyError, ValueError) as err:
            print(f"AC entry skip: {err}")

    print(f"[async] {username}: {len(history)} entries, LC solved={lc_solved}")
    return history, lc_solved