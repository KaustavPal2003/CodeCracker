# tracker/views/api_views.py
import asyncio
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from tracker.models import UserStats
from tracker.utils.contest_tracker import fetch_all_async
from tracker.utils.codeforces import fetch_codeforces_rating_history
from tracker.utils.selenium_scraper import fetch_codechef_contest_history_selenium

@login_required
def fetch_all_contest_history_view(request, username):
    try:
        print(f"Starting contest history fetch for {username}")
        data = asyncio.run(fetch_all_async(username))
        print(f"Fetched contest data: {data}")

        rating_history = []
        for platform, contests in data.items():
            if isinstance(contests, list) and contests:
                print(f"Processing {platform} contests: {len(contests)} entries")
                for contest in contests:
                    entry = {
                        "platform": platform.capitalize(),
                        "contest": contest.get("contestName") or contest.get("contest") or "Unknown",
                        "rank": contest.get("rank", 0),
                        "new_rating": contest.get("newRating") or contest.get("new_rating", 0),
                        "old_rating": contest.get("oldRating", 0),
                        "change": contest.get("ratingChange") or contest.get("change", 0),
                        "date": contest.get("date", "Unknown")
                    }
                    rating_history.append(entry)
            else:
                print(f"No valid contests for {platform}")

        if rating_history:
            print(f"Storing {len(rating_history)} entries for {username}")
            UserStats.objects(username=username).update_one(
                set__rating_history=rating_history,
                upsert=True
            )
            print(f"Successfully stored contest history for {username}")
        else:
            print(f"No contest history to store for {username}")

        return JsonResponse({"status": "success", "data": data}, safe=False)
    except Exception as e:
        print(f"Error in fetch_all_contest_history_view: {str(e)}")
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

@login_required
def fetch_codeforces_history_view(request, username):
    try:
        data = fetch_codeforces_rating_history(username)
        return JsonResponse({"status": "success", "data": data}, safe=False)
    except Exception as e:
        print(f"Error in fetch_codeforces_history_view: {str(e)}")
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

@login_required
def fetch_codechef_history_view(request, username):
    try:
        data = fetch_codechef_contest_history_selenium(username)
        return JsonResponse({"status": "success", "data": data}, safe=False)
    except Exception as e:
        print(f"Error in fetch_codechef_history_view: {str(e)}")
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

# Synchronous test view
def test_db_connection(request):
    """Check MongoDB connection and return a list of users."""
    try:
        users = UserStats.objects.all()
        user_list = [{"username": user.username, "rating": user.codeforces_rating} for user in users]
        return JsonResponse({"status": "success", "users": user_list})
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)})