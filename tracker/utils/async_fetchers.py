# async_fetchers.py
import asyncio
import aiohttp
from datetime import datetime
from tracker.utils.selenium_scraper import fetch_codechef_contest_history_selenium

async def fetch_codeforces(http_session, username):
    print(f"Fetching Codeforces history for {username}")
    url = f"https://codeforces.com/api/user.rating?handle={username}"
    try:
        async with http_session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
            if response.status != 200:
                print(f"Codeforces API error: {response.status}")
                return []
            data = await response.json()
            if data["status"] != "OK":
                print(f"Codeforces API failed: {data.get('comment', 'Unknown error')}")
                return []
            print(f"Codeforces fetched {len(data['result'])} contests")
            return data["result"]
    except Exception as e:
        print(f"Error fetching Codeforces: {e}")
        return []

async def fetch_codechef(username):
    """
    Fetch historical contest data from CodeChef using Selenium scraper asynchronously.
    Returns list of dicts with contest history.
    """
    print(f"Fetching CodeChef contest history for {username}")
    try:
        contests = await asyncio.to_thread(fetch_codechef_contest_history_selenium, username)
        if not contests:
            print(f"No CodeChef contest history found for {username}")
            return []

        formatted_contests = []
        for contest in contests:
            try:
                date_str = contest.get("date", "")
                if not date_str:
                    date = datetime.now()
                elif " " in date_str:
                    date = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                else:
                    date = datetime.strptime(date_str, "%Y-%m-%d")

                formatted_contests.append({
                    "contest": contest.get("contest", "Unknown Contest"),
                    "rank": int(contest.get("rank", 0)),
                    "old_rating": int(contest.get("old_rating", 0)),
                    "new_rating": int(contest.get("new_rating", 0)),
                    "date": date.strftime("%Y-%m-%d %H:%M:%S")
                })
            except (ValueError, TypeError) as e:
                print(f"Error processing CodeChef contest entry: {e}")
                continue

        print(f"CodeChef fetched {len(formatted_contests)} historical contests")
        return formatted_contests
    except Exception as e:
        print(f"Error fetching CodeChef history: {e}")
        return []

async def fetch_leetcode_solved(http_session, username):
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
        async with http_session.post(url, json=query, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
            if response.status != 200:
                print(f"LeetCode solved API error: {response.status}")
                return 0
            data = await response.json()
            if not data.get("data", {}).get("matchedUser"):
                print(f"No LeetCode profile found for {username}")
                return 0
            total_solved = sum(item["count"] for item in data["data"]["matchedUser"]["submitStats"]["acSubmissionNum"])
            print(f"LeetCode solved: {total_solved}")
            return total_solved
    except Exception as e:
        print(f"Error fetching LeetCode solved: {e}")
        return 0

async def fetch_leetcode(http_session, username, include_non_attended=False):
    """
    Fetch LeetCode contest history and total solved problems.
    Returns tuple (total_solved, history).
    """
    print(f"Fetching LeetCode contest history for {username}")
    url = "https://leetcode.com/graphql/"
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
    headers = {
        "Content-Type": "application/json",
        "Referer": f"https://leetcode.com/{username}/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    try:
        async with http_session.post(url, json=query, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
            if response.status != 200:
                print(f"LeetCode API error: {response.status}")
                total_solved = await fetch_leetcode_solved(http_session, username)
                return total_solved, []

            data = await response.json()
            if "errors" in data or not data.get("data"):
                print(f"LeetCode query error: {data.get('errors', 'No data')}")
                total_solved = await fetch_leetcode_solved(http_session, username)
                return total_solved, []

            ranking_data = data["data"].get("userContestRanking")
            history_data = data["data"].get("userContestRankingHistory", [])
            print(f"LeetCode fetched {len(history_data)} contest entries")

            if not history_data:
                total_solved = await fetch_leetcode_solved(http_session, username)
                return total_solved, []

            history = []
            for entry in history_data:
                if not include_non_attended and not entry["attended"]:
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

            total_solved = await fetch_leetcode_solved(http_session, username)
            print(f"LeetCode fetched {len(history)} contests, {total_solved} solved")
            return total_solved, history
    except Exception as e:
        print(f"Error fetching LeetCode: {e}")
        total_solved = await fetch_leetcode_solved(http_session, username)
        return total_solved, []

async def fetch_and_store_rating_history_async(username):
    """
    Fetch and store historical rating data from all platforms asynchronously.
    Returns tuple (history, leetcode_solved).
    """
    print(f"Starting async rating history fetch for {username}")
    async with aiohttp.ClientSession() as session:
        cf_task = fetch_codeforces(session, username)
        cc_task = fetch_codechef(username)
        lc_task = fetch_leetcode(session, username)
        cf_data, cc_data, (lc_solved, lc_history) = await asyncio.gather(cf_task, cc_task, lc_task)

    from tracker.models import RatingHistory
    history = []

    # Codeforces history
    for entry in cf_data:
        try:
            date = datetime.fromtimestamp(entry["ratingUpdateTimeSeconds"])
            history.append(RatingHistory(
                platform="Codeforces",
                contest=entry["contestName"],
                rank=entry["rank"],
                old_rating=entry["oldRating"],
                new_rating=entry["newRating"],
                date=date
            ))
        except (KeyError, ValueError) as e:
            print(f"Error processing Codeforces entry: {e}")
            continue

    # CodeChef history
    for entry in cc_data:
        try:
            date = datetime.strptime(entry["date"], "%Y-%m-%d %H:%M:%S")
            history.append(RatingHistory(
                platform="CodeChef",
                contest=entry["contest"],
                rank=entry["rank"],
                old_rating=entry["old_rating"],
                new_rating=entry["new_rating"],
                date=date
            ))
        except (KeyError, ValueError) as e:
            print(f"Error processing CodeChef entry: {e}")
            continue

    # LeetCode history
    for entry in lc_history:
        try:
            date = datetime.strptime(entry["date"], "%Y-%m-%d %H:%M:%S")
            history.append(RatingHistory(
                platform="LeetCode",
                contest=entry["contest"],
                rank=entry["rank"],
                old_rating=entry["old_rating"],
                new_rating=entry["new_rating"],
                date=date
            ))
        except (KeyError, ValueError) as e:
            print(f"Error processing LeetCode entry: {e}")
            continue

    print(f"Collected rating history for {username}: {len(history)} entries, LeetCode solved: {lc_solved}")
    return history, lc_solved

if __name__ == "__main__":
    async def test():
        async with aiohttp.ClientSession() as session:
            print("\nTesting async fetch for 'tourist':")
            history, lc_solved = await fetch_and_store_rating_history_async("tourist")
            print(f"Total history entries: {len(history)}, LeetCode solved: {lc_solved}")

    asyncio.run(test())