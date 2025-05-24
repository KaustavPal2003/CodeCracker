import requests
from django.core.cache import cache

def fetch_leetcode_stats(username):
    """Fetch LeetCode solved problems count using API with caching."""
    cache_key = f"leetcode_stats_{username}"
    cached_stats = cache.get(cache_key)
    if cached_stats is not None:
        return cached_stats
    
    url = f"https://leetcode-stats-api.herokuapp.com/{username}"
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        solved = data.get("totalSolved", 0)
        cache.set(cache_key, solved, timeout=3600)
        return solved
    except Exception as e:
        print(f"⚠️ LeetCode API Error: {e}")
    return 0


