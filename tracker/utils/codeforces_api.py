# tracker/utils/codeforces_api.py
from django.core.cache import cache
from django.http import JsonResponse
import requests

def fetch_codeforces_contest_history(username):
    """Fetch contest history from Codeforces API with caching."""
    cache_key = f"codeforces_contests_{username}"
    cached_data = cache.get(cache_key)
    
    if cached_data is not None:
        print(f"Retrieved cached data for {username}")
        return cached_data
    
    url = f"https://codeforces.com/api/contest.ratingChanges?handle={username}"
    try:
        response = requests.get(url, timeout=10)
        data = response.json()
        
        print("✅ Codeforces API Response:", data)

        # Check for a successful response
        if data.get("status") != "OK":
            error_msg = data.get("comment", "Unknown error")
            return {"error": f"⚠️ Codeforces API Error: {error_msg}"}
        
        contests = data.get("result", [])

        # Filter and format valid contest data
        valid_contests = [
            {
                "contestId": c.get("contestId"),
                "contestName": c.get("contestName", "Unknown"),
                "rank": c.get("rank", "N/A"),
                "oldRating": c.get("oldRating", 0),
                "newRating": c.get("newRating", 0),
                "ratingChange": c.get("newRating", 0) - c.get("oldRating", 0),
            }
            for c in contests if isinstance(c.get("contestId"), int)
        ]
        
        print("✅ Valid Contest Data:", valid_contests)

        # Cache the valid contest data for 1 hour
        cache.set(cache_key, valid_contests, timeout=3600)
        return valid_contests if valid_contests else {"message": "⚠️ No contest history available."}
    
    except requests.exceptions.Timeout:
        print("❌ Codeforces API Timeout")
        return {"error": "⚠️ Codeforces API timed out. Try again later."}
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return {"error": f"⚠️ Failed to fetch contest history: {e}"}
    except ValueError as e:
        print(f"❌ JSON Decode Error: {e}")
        return {"error": "⚠️ Invalid JSON response from Codeforces."}
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return {"error": f"⚠️ Unexpected error: {e}"}

# API View
def fetch_codeforces_history_view(username):
    """API view for fetching Codeforces contest history."""
    try:
        result = fetch_codeforces_contest_history(username)

        # Check for errors in the result
        if isinstance(result, dict) and "error" in result:
            return JsonResponse(result, status=400 if "API Error" in result["error"] else 500)

        return JsonResponse({"status": "success", "data": result}, safe=False)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)