# tracker/utils/sync_fetchers.py
"""
Upgraded:
  • selenium_scraper replaced with codechef_api.py
  • AtCoder added to both fetch functions
"""
from datetime import datetime
import requests

from tracker.models import UserStats, RatingHistory
from tracker.utils.codechef_api import fetch_codechef_contest_history
from tracker.utils.atcoder import fetch_atcoder_history


def fetch_codeforces_sync(username):
    try:
        r = requests.get(
            f"https://codeforces.com/api/user.rating?handle={username}",
            timeout=10
        )
        r.raise_for_status()
        data = r.json()
        if data["status"] != "OK":
            return []
        return data["result"]
    except Exception as e:
        print(f"Codeforces sync error ({username}): {e}")
        return []


def fetch_leetcode_solved_sync(username):
    url   = "https://leetcode.com/graphql/"
    query = {
        "query": """query getUserProfile($username: String!) {
            matchedUser(username: $username) {
                submitStats: submitStatsGlobal { acSubmissionNum { difficulty count } }
            }
        }""",
        "variables": {"username": username}
    }
    headers = {"Content-Type": "application/json",
               "Referer": f"https://leetcode.com/{username}/",
               "User-Agent": "Mozilla/5.0"}
    try:
        r    = requests.post(url, json=query, headers=headers, timeout=10)
        data = r.json()
        mu   = data.get("data", {}).get("matchedUser")
        if not mu:
            return 0
        all_entry = next(
            (i for i in mu["submitStats"]["acSubmissionNum"] if i["difficulty"] == "All"),
            None
        )
        return all_entry["count"] if all_entry else 0
    except Exception as e:
        print(f"LeetCode solved sync error ({username}): {e}")
        return 0


def fetch_leetcode_sync(username):
    url   = "https://leetcode.com/graphql/"
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
    headers = {"Content-Type": "application/json",
               "Referer": f"https://leetcode.com/{username}/",
               "User-Agent": "Mozilla/5.0"}
    try:
        r    = requests.post(url, json=query, headers=headers, timeout=10)
        data = r.json()
        if "errors" in data or not data.get("data"):
            return fetch_leetcode_solved_sync(username), []

        history = []
        for e in data["data"].get("userContestRankingHistory", []):
            if not e["attended"]:
                continue
            dt = datetime.fromtimestamp(e["contest"]["startTime"])
            history.append({
                "contest":    e["contest"]["title"],
                "rank":       int(e.get("ranking", 0)),
                "old_rating": 0,
                "new_rating": int(e["rating"]),
                "date":       dt.strftime("%Y-%m-%d %H:%M:%S"),
            })
        return fetch_leetcode_solved_sync(username), history
    except Exception as e:
        print(f"LeetCode sync error ({username}): {e}")
        return fetch_leetcode_solved_sync(username), []


def fetch_and_store_rating_history(username, include_atcoder=True):
    """
    Synchronous full fetch: CF + CC (API) + LC + AtCoder.
    Stores to MongoDB. Returns (history, lc_solved).
    """
    print(f"[sync] fetching rating history for {username}")
    history = []

    # Look up platform-specific handles from UserProfile
    try:
        from tracker.models import UserProfile
        profile = UserProfile.objects(username=username).first()
        lc_handle = (profile.leetcode_handle.strip() if profile and profile.leetcode_handle.strip() else username)
        cc_handle = (profile.codechef_handle.strip() if profile and profile.codechef_handle.strip() else username)
        cf_handle = (profile.codeforces_handle.strip() if profile and profile.codeforces_handle.strip() else username)
        ac_handle = (profile.atcoder_handle.strip() if profile and profile.atcoder_handle.strip() else username)
    except Exception:
        lc_handle = cc_handle = cf_handle = ac_handle = username

    print(f"[sync] handles — CF:{cf_handle} LC:{lc_handle} CC:{cc_handle} AC:{ac_handle}")

    # Codeforces
    for e in fetch_codeforces_sync(cf_handle):
        try:
            dt = datetime.fromtimestamp(e["ratingUpdateTimeSeconds"])
            history.append(RatingHistory(
                platform="Codeforces", contest=e["contestName"],
                rank=e["rank"], old_rating=e["oldRating"], new_rating=e["newRating"],
                date=dt, change=e["newRating"] - e["oldRating"]
            ))
        except (KeyError, ValueError):
            pass

    # CodeChef (API-based)
    for e in fetch_codechef_contest_history(cc_handle):
        try:
            dt = datetime.strptime(e["date"], "%Y-%m-%d %H:%M:%S")
            history.append(RatingHistory(
                platform="CodeChef", contest=e["contest"],
                rank=e["rank"], old_rating=e["old_rating"], new_rating=e["new_rating"],
                date=dt, change=e["new_rating"] - e["old_rating"]
            ))
        except (KeyError, ValueError):
            pass

    # LeetCode
    lc_solved, lc_hist = fetch_leetcode_sync(lc_handle)
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

    # AtCoder
    if include_atcoder:
        ac_hist, _ = fetch_atcoder_history(ac_handle)
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

    # Persist
    try:
        user = UserStats.objects(username=username).first() or UserStats(username=username)
        user.rating_history   = history
        user.leetcode_solved  = lc_solved
        user.codeforces_rating = max(
            (h.new_rating for h in history if h.platform == "Codeforces"), default=0)
        user.codechef_rating  = max(
            (h.new_rating for h in history if h.platform == "CodeChef"), default=0)
        user.atcoder_rating   = max(
            (h.new_rating for h in history if h.platform == "AtCoder"), default=0)
        user.last_updated = datetime.utcnow()
        user.save()
        print(f"[sync] stored {len(history)} entries for {username}")
    except Exception as e:
        print(f"[sync] store error: {e}")

    return history, lc_solved


def fetch_and_store_user_stats(username):
    from django.core.cache import cache
    cache_key = f"user_stats_{username}"
    cached    = cache.get(cache_key)
    if cached:
        return cached

    history, lc_solved = fetch_and_store_rating_history(username)
    user = UserStats.objects(username=username).first()
    if user:
        cache.set(cache_key, user, timeout=3600)
    return user