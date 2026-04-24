# fetch_coordinator.py
from asgiref.sync import sync_to_async
from tracker.models import UserStats
from .async_fetchers import fetch_and_store_rating_history_async
from .sync_fetchers import fetch_and_store_rating_history

async def fetch_and_store_all(username):
    """Fetch and store all user data (stats and history) asynchronously."""
    print(f"Fetching all data for {username}")

    user = await sync_to_async(UserStats.objects.filter(username=username).first)()
    if not user:
        user = UserStats(username=username)
        await sync_to_async(user.save)()

    try:
        history, lc_solved = await fetch_and_store_rating_history_async(username)
        user.rating_history = history
        user.leetcode_solved = lc_solved
        user.codeforces_rating = max((h.new_rating for h in history if h.platform == "Codeforces"), default=0)
        user.codechef_rating = max((h.new_rating for h in history if h.platform == "CodeChef"), default=0)
        await sync_to_async(user.save)()
        print(f"Stored async rating history for {username}: {len(history)} entries, LeetCode solved: {lc_solved}")
    except Exception as e:
        print(f"Error in async fetch for {username}: {str(e)}")
        # Fallback to sync
        history, lc_solved = await sync_to_async(fetch_and_store_rating_history)(username)
        user.leetcode_solved = lc_solved
        user.codeforces_rating = max((h.new_rating for h in history if h.platform == "Codeforces"), default=0)
        user.codechef_rating = max((h.new_rating for h in history if h.platform == "CodeChef"), default=0)
        await sync_to_async(user.save)()
        print(f"Stored sync fallback rating history for {username}: {len(history)} entries, LeetCode solved: {lc_solved}")

    return user