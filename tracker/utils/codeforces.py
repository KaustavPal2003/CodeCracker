import requests
import aiohttp
from datetime import datetime
from django.core.cache import cache
import asyncio

def fetch_codeforces_stats(username):
    """Fetch Codeforces rating using API with caching."""
    cache_key = f"codeforces_rating_{username}"
    cached_rating = cache.get(cache_key)
    if cached_rating is not None:
        return cached_rating
    url = f"https://codeforces.com/api/user.info?handles={username}"
    try:
        response = requests.get(url, timeout=5)
        data = response.json()
        if data.get("status") == "OK":
            rating = data["result"][0].get("rating", 0)
            cache.set(cache_key, rating, timeout=3600)
            return rating
    except Exception as e:
        print(f"⚠️ Codeforces API Error: {e}")
    return 0

async def fetch_codeforces_rating_history_async(username):
    """Fetch rating history from Codeforces API asynchronously with caching."""
    cache_key = f"codeforces_history_{username}"
    cached_history = cache.get(cache_key)
    if cached_history is not None:
        return cached_history
    
    url = f"https://codeforces.com/api/user.rating?handle={username}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                data = await resp.json()
                if data["status"] != "OK":
                    return {"error": f"⚠️ Codeforces API Error: {data.get('comment', 'Unknown error')}"}
                history = [
                    {
                        "contestId": entry["contestId"],
                        "contestName": entry["contestName"],
                        "rank": entry["rank"],
                        "oldRating": entry["oldRating"],
                        "newRating": entry["newRating"],
                        "ratingChange": entry["newRating"] - entry["oldRating"],
                        "date": datetime.fromtimestamp(entry["ratingUpdateTimeSeconds"]).isoformat()
                    }
                    for entry in data["result"]
                ]
                cache.set(cache_key, history, timeout=3600)
                return history if history else {"message": "⚠️ No contest history available."}
    except aiohttp.ClientError as e:
        return {"error": f"⚠️ Codeforces API failed: {str(e)}"}

def fetch_codeforces_rating_history(username):
    print(f"Fetching Codeforces history for {username}")
    try:
        url = f"https://codeforces.com/api/user.rating?handle={username}"
        response = requests.get(url)
        data = response.json()
        if data["status"] == "OK":
            print(f"Codeforces fetched {len(data['result'])} contests: {data['result']}")
            return data["result"]
        else:
            print(f"Codeforces API error: {data.get('comment', 'Unknown error')}")
            return []
    except Exception as e:
        print(f"Error fetching Codeforces history: {str(e)}")
        return []