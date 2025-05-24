# sync_fetchers.py
from datetime import datetime

import requests

from tracker.models import UserStats, RatingHistory
from tracker.utils.selenium_scraper import fetch_codechef_contest_history_selenium


def fetch_codeforces_sync(username):
    print(f"Fetching Codeforces history for {username}")
    try:
        url = f"https://codeforces.com/api/user.rating?handle={username}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        if data["status"] != "OK":
            print(f"Codeforces API failed: {data.get('comment', 'Unknown error')}")
            return []
        print(f"Codeforces fetched {len(data['result'])} contests")
        return data["result"]
    except Exception as e:
        print(f"Error fetching Codeforces: {e}")
        return []

def fetch_leetcode_sync(username):
    """
    Synchronous version of LeetCode fetch.
    Returns tuple (total_solved, history).
    """
    print(f"Fetching LeetCode contest history for {username}")
    url = "https://leetcode.com/graphql/"
    headers = {
        "Content-Type": "application/json",
        "Referer": f"https://leetcode.com/{username}/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    # Fetch contest history
    query = {
        "operationName": "userContestRankingInfo",
        "query": """
            query userContestRankingInfo($username: String!) {
                userContestRanking(username: $username) {
                    attendedContestsCount
                    rating
                    globalRanking
                    totalParticipants
                    topPercentage
                    badge { name }
                }
                userContestRankingHistory(username: $username) {
                    attended
                    trendDirection
                    problemsSolved
                    totalProblems
                    finishTimeInSeconds
                    rating
                    ranking
                    contest { title startTime }
                }
            }
        """,
        "variables": {"username": username}
    }
    try:
        response = requests.post(url, json=query, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        if "errors" in data or not data.get("data"):
            print(f"LeetCode query error: {data.get('errors', 'No data')}")
            total_solved = fetch_leetcode_solved_sync(username)
            return total_solved, []

        history_data = data["data"].get("userContestRankingHistory", [])
        if not history_data:
            print(f"No LeetCode contest history for {username}")
            total_solved = fetch_leetcode_solved_sync(username)
            return total_solved, []

        history = []
        for entry in history_data:
            if not entry["attended"]:  # Skip non-attended contests
                continue
            date = datetime.fromtimestamp(entry["contest"]["startTime"])
            history.append({
                "contest": entry["contest"]["title"],
                "rank": int(entry.get("ranking", 0)),
                "old_rating": 0,  # LeetCode doesn’t provide old_rating
                "new_rating": int(entry["rating"]),
                "date": date.strftime("%Y-%m-%d %H:%M:%S"),
                "attended": entry["attended"],
                "problems_solved": entry["problemsSolved"]
            })

        total_solved = fetch_leetcode_solved_sync(username)
        print(f"LeetCode fetched {len(history)} contests, {total_solved} solved")
        return total_solved, history
    except Exception as e:
        print(f"Error fetching LeetCode: {e}")
        total_solved = fetch_leetcode_solved_sync(username)
        return total_solved, []

def fetch_leetcode_solved_sync(username):
    url = "https://leetcode.com/graphql/"
    query = {
        "query": """
            query getUserProfile($username: String!) {
                matchedUser(username: $username) {
                    submitStats: submitStatsGlobal {
                        acSubmissionNum {
                            count
                        }
                    }
                }
            }
        """,
        "variables": {"username": username}
    }
    headers = {
        "Content-Type": "application/json",
        "Referer": f"https://leetcode.com/{username}/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    try:
        response = requests.post(url, json=query, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        if not data.get("data", {}).get("matchedUser"):
            print(f"No LeetCode profile found for {username}")
            return 0
        total_solved = sum(item["count"] for item in data["data"]["matchedUser"]["submitStats"]["acSubmissionNum"])
        print(f"LeetCode solved: {total_solved}")
        return total_solved
    except Exception as e:
        print(f"Error fetching LeetCode solved: {e}")
        return 0

def fetch_and_store_rating_history(username):
    """Synchronous fallback for rating history fetching."""
    print(f"Starting synchronous rating history fetch for {username}")
    history = []

    # Codeforces
    cf_data = fetch_codeforces_sync(username)
    for entry in cf_data:
        try:
            date = datetime.fromtimestamp(entry["ratingUpdateTimeSeconds"])
            history.append(RatingHistory(
                platform="Codeforces",
                contest=entry["contestName"],
                rank=entry["rank"],
                old_rating=entry["oldRating"],
                new_rating=entry["newRating"],
                date=date,
                change=entry["newRating"] - entry["oldRating"]
            ))
        except (KeyError, ValueError) as e:
            print(f"Error processing Codeforces entry: {e}")
            continue

    # CodeChef
    cc_data = fetch_codechef_contest_history_selenium(username)
    for entry in cc_data:
        try:
            date = datetime.strptime(entry["date"], "%Y-%m-%d %H:%M:%S")
            history.append(RatingHistory(
                platform="CodeChef",
                contest=entry["contest"],
                rank=entry["rank"],
                old_rating=entry["old_rating"],
                new_rating=entry["new_rating"],
                date=date,
                change=entry["new_rating"] - entry["old_rating"]
            ))
        except (KeyError, ValueError) as e:
            print(f"Error processing CodeChef entry: {e}")
            continue

    # LeetCode
    lc_solved, lc_history = fetch_leetcode_sync(username)
    for entry in lc_history:
        try:
            date = datetime.strptime(entry["date"], "%Y-%m-%d %H:%M:%S")
            history.append(RatingHistory(
                platform="LeetCode",
                contest=entry["contest"],
                rank=entry["rank"],
                old_rating=entry["old_rating"],
                new_rating=entry["new_rating"],
                date=date,
                change=entry["new_rating"] - entry["old_rating"] if entry["old_rating"] else 0
            ))
        except (KeyError, ValueError) as e:
            print(f"Error processing LeetCode entry: {e}")
            continue

    # Store in MongoDB
    try:
        user = UserStats.objects(username=username).first()
        if not user:
            user = UserStats(username=username)
        user.rating_history = history
        user.leetcode_solved = lc_solved
        user.codeforces_rating = max((h.new_rating for h in history if h.platform == "Codeforces"), default=0)
        user.codechef_rating = max((h.new_rating for h in history if h.platform == "CodeChef"), default=0)
        user.last_updated = datetime.utcnow()
        user.save()
        print(f"Stored rating history for {username}: {len(history)} entries, LeetCode solved: {lc_solved}")
    except Exception as e:
        print(f"Error storing rating history: {e}")

    return history, lc_solved

def fetch_and_store_user_stats(username):
    """Fetch and store user stats from Codeforces, LeetCode, and CodeChef."""
    from django.core.cache import cache
    cache_key = f"user_stats_{username}"
    cached_user = cache.get(cache_key)
    if cached_user:
        print(f"Retrieved cached stats for {username}")
        UserStats.objects(username=username).update_one(
            set__codeforces_rating=cached_user.codeforces_rating,
            set__leetcode_solved=cached_user.leetcode_solved,
            set__codechef_rating=cached_user.codechef_rating,
            set__last_updated=cached_user.last_updated,
            upsert=True
        )
        return UserStats.objects(username=username).first()

    print(f"Fetching user stats for {username}")
    user_data = {"codeforces_rating": 0, "leetcode_solved": 0, "codechef_rating": 0}

    # Codeforces
    try:
        cf_url = f"https://codeforces.com/api/user.info?handles={username}"
        cf_response = requests.get(cf_url, timeout=10)
        cf_response.raise_for_status()
        cf_data = cf_response.json()
        if cf_data["status"] == "OK" and cf_data["result"]:
            user_data["codeforces_rating"] = cf_data["result"][0].get("rating", 0)
            print(f"Codeforces rating fetched: {user_data['codeforces_rating']}")
    except Exception as e:
        print(f"Codeforces fetch failed: {e}")

    # LeetCode
    user_data["leetcode_solved"] = fetch_leetcode_solved_sync(username)

    # CodeChef
    cc_data = fetch_codechef_contest_history_selenium(username)
    if cc_data:
        user_data["codechef_rating"] = max((entry["new_rating"] for entry in cc_data), default=0)
        print(f"CodeChef rating fetched: {user_data['codechef_rating']}")

    # Store in MongoDB and cache
    try:
        UserStats.objects(username=username).update_one(
            set__codeforces_rating=user_data["codeforces_rating"],
            set__leetcode_solved=user_data["leetcode_solved"],
            set__codechef_rating=user_data["codechef_rating"],
            set__last_updated=datetime.utcnow(),
            upsert=True
        )
        user = UserStats.objects(username=username).first()
        cache.set(cache_key, user, timeout=3600)
        print(f"Stored user stats: CF={user_data['codeforces_rating']}, LC={user_data['leetcode_solved']}, CC={user_data['codechef_rating']}")
        return user
    except Exception as e:
        print(f"Error storing user stats: {e}")
        return None

if __name__ == "__main__":
    history, lc_solved = fetch_and_store_rating_history("uwi")
    print(f"Total history entries: {len(history)}, LeetCode solved: {lc_solved}")