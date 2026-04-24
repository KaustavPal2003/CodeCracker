# tracker/views/api_views.py  — Selenium removed
import asyncio
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from tracker.models import UserStats
from tracker.utils.contest_tracker import fetch_all_async
from tracker.utils.codeforces import fetch_codeforces_rating_history
from tracker.utils.codechef_api import fetch_codechef_contest_history  # ← no more Selenium


def get_suggestions(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse({'suggestions': []})
    suggestions = UserStats.objects(username__icontains=query).only('username')[:10]
    return JsonResponse({'suggestions': [u.username for u in suggestions]})


@login_required
def fetch_all_contest_history_view(request, username):
    try:
        data = asyncio.run(fetch_all_async(username))
        rating_history = []
        for platform, contests in data.items():
            if not isinstance(contests, list):
                continue
            for contest in contests:
                rating_history.append({
                    "platform":   platform.capitalize(),
                    "contest":    contest.get("contestName") or contest.get("contest") or "Unknown",
                    "rank":       contest.get("rank", 0),
                    "new_rating": contest.get("newRating")  or contest.get("new_rating", 0),
                    "old_rating": contest.get("oldRating", 0),
                    "change":     contest.get("ratingChange") or contest.get("change", 0),
                    "date":       contest.get("date", ""),
                })

        if rating_history:
            UserStats.objects(username=username).update_one(
                set__rating_history=rating_history, upsert=True)

        return JsonResponse({"status": "success", "data": data}, safe=False)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


@login_required
def fetch_codeforces_history_view(request, username):
    try:
        data = fetch_codeforces_rating_history(username)
        return JsonResponse({"status": "success", "data": data}, safe=False)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


@login_required
def fetch_codechef_history_view(request, username):
    try:
        data = fetch_codechef_contest_history(username)   # ← API-based
        return JsonResponse({"status": "success", "data": data}, safe=False)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


def test_db_connection(request):
    try:
        users = UserStats.objects.all()
        return JsonResponse({
            "status": "success",
            "users": [{"username": u.username, "rating": u.codeforces_rating} for u in users]
        })
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)})
