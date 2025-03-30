import asyncio
import aiohttp
from bs4 import BeautifulSoup
from datetime import datetime


async def fetch_and_store_rating_history_async(username):
    """Fetch rating history asynchronously for a given username."""
    print(f"Fetching rating history async for {username}")

    async def fetch_codeforces(http_session):
        """Fetch Codeforces rating history."""
        print(f"Fetching Codeforces history for {username}")
        url = f"https://codeforces.com/api/user.rating?handle={username}"
        async with http_session.get(url) as response:
            if response.status != 200:
                print(f"Codeforces API error: {response.status} - {await response.text()}")
                return []
            data = await response.json()
            if data["status"] != "OK":
                print(f"Codeforces API failed: {data.get('comment', 'Unknown error')}")
                return []
            return data["result"]

    async def fetch_codechef(http_session):
        """Fetch CodeChef current rating."""
        print(f"Fetching CodeChef history for {username}")
        url = f"https://www.codechef.com/users/{username}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        async with http_session.get(url, headers=headers) as response:
            if response.status != 200:
                print(f"CodeChef fetch error: {response.status}")
                return []
            html = await response.text()
            soup = BeautifulSoup(html, "html.parser")
            rating_elem = soup.select_one(".rating-number")
            if not rating_elem:
                print(f"No CodeChef rating found for {username} - Page may not exist or structure changed")
                return []
            try:
                current_rating = int(rating_elem.text.strip())
                print(f"Found CodeChef rating for {username}: {current_rating}")
                return [{
                    "contest": "Latest Rating",
                    "rank": 0,
                    "new_rating": current_rating,
                    "old_rating": 0,
                    "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }]
            except ValueError:
                print(f"Invalid CodeChef rating format for {username}: {rating_elem.text}")
                return []

    async def fetch_leetcode(http_session):
        """Fetch LeetCode solved problems count."""
        print(f"Fetching LeetCode stats for {username}")
        url = "https://leetcode.com/graphql/"
        query = {
            "query": """
                query getUserProfile($username: String!) {
                    matchedUser(username: $username) {
                        submitStats: submitStatsGlobal {
                            acSubmissionNum {
                                difficulty
                                count
                            }
                        }
                    }
                }
            """,
            "variables": {"username": username}
        }
        async with http_session.post(url, json=query) as response:
            if response.status != 200:
                print(f"LeetCode API error: {response.status} - {await response.text()}")
                return 0
            data = await response.json()
            if data.get("data", {}).get("matchedUser") is None:
                print(f"LeetCode user {username} not found")
                return 0
            try:
                stats = data["data"]["matchedUser"]["submitStats"]["acSubmissionNum"]
                total_solved = sum(item["count"] for item in stats)
                print(f"Found {total_solved} LeetCode solved for {username}")
                return total_solved
            except (KeyError, TypeError) as e:
                print(f"LeetCode data parsing error for {username}: {e}")
                return 0

    async with aiohttp.ClientSession() as session:
        cf_task = asyncio.create_task(fetch_codeforces(session))
        cc_task = asyncio.create_task(fetch_codechef(session))
        lc_task = asyncio.create_task(fetch_leetcode(session))
        cf_data, cc_data, lc_solved = await asyncio.gather(cf_task, cc_task, lc_task)

    from tracker.models import RatingHistory  # Moved import here to avoid circular imports
    history = []
    for entry in cf_data:
        date_obj = datetime.fromtimestamp(entry["ratingUpdateTimeSeconds"])
        history.append(RatingHistory(
            platform="Codeforces",
            contest=entry["contestName"],
            rank=entry["rank"],
            old_rating=entry["oldRating"],
            new_rating=entry["newRating"],
            date=date_obj
        ))

    for entry in cc_data:
        date_obj = datetime.strptime(entry["date"], "%Y-%m-%d %H:%M:%S")
        history.append(RatingHistory(
            platform="CodeChef",
            contest=entry["contest"],
            rank=entry["rank"],
            old_rating=entry["old_rating"],
            new_rating=entry["new_rating"],
            date=date_obj
        ))

    print(f"Retrieved {len(history)} contests and {lc_solved} LeetCode solved for {username}")
    return history, lc_solved