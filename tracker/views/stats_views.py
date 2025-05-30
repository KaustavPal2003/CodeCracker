#stats_views.py
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_GET
from django.shortcuts import render, redirect
from django.core.cache import cache
from asgiref.sync import sync_to_async
from tracker.models import UserStats, RatingHistory
from tracker.utils.async_fetchers import fetch_and_store_rating_history_async
from tracker.utils.sync_fetchers import fetch_and_store_rating_history
from datetime import datetime
from django.http import JsonResponse


@login_required
@require_GET
async def fetch_user_stats(request, username):
    print(f"Fetching stats for user: {username}")

    logged_in_username = await sync_to_async(lambda: request.user.username)()
    if logged_in_username != username:
        return await sync_to_async(render)(request, "tracker/error.html", {"message": "Unauthorized access"})

    user_stats = await sync_to_async(UserStats.objects(username=username).no_cache().first)()
    if not user_stats:
        user_stats = UserStats(username=username)
        await sync_to_async(user_stats.save)()

    cache_key = f"rating_history_{username}"
    history = await sync_to_async(cache.get)(cache_key)
    lc_solved = user_stats.leetcode_solved

    # Validate history format
    if not history or not isinstance(history, list) or (history and isinstance(history[0], str) and history[0] in {"username", "codeforces_rating"}):
        print(f"Invalid or missing history in cache for {username}: {history}. Fetching fresh data.")
        history, lc_solved = await fetch_and_store_rating_history_async(username)
        await sync_to_async(cache.set)(cache_key, history, timeout=None)

    processed_history = []
    if history:
        for entry in history:
            if isinstance(entry, str):
                try:
                    import json
                    entry = json.loads(entry)
                except json.JSONDecodeError:
                    print(f"Skipping invalid history entry for {username}: {entry}")
                    continue
            elif hasattr(entry, 'to_mongo'):
                entry = entry.to_mongo().to_dict()

            entry_dict = {
                "platform": getattr(entry, 'platform', entry.get('platform', '')),
                "contest": getattr(entry, 'contest', entry.get('contest', '')),
                "old_rating": getattr(entry, 'old_rating', entry.get('old_rating', 0)),
                "new_rating": getattr(entry, 'new_rating', entry.get('new_rating', 0)),
                "rank": getattr(entry, 'rank', entry.get('rank', 0)),
                "change": getattr(entry, 'change', entry.get('change', 0)),
                "date": (entry.date.isoformat() if hasattr(entry, 'date') and entry.date
                         else entry.get('date', "1970-01-01T00:00:00"))
            }
            processed_history.append(entry_dict)
    else:
        print(f"No contest history found for {username}")

    if processed_history:
        user_stats.codeforces_rating = max(
            (h["new_rating"] for h in processed_history if h["platform"] == "Codeforces"), default=None)
        user_stats.codechef_rating = max((h["new_rating"] for h in processed_history if h["platform"] == "Codechef"),
                                         default=None)
        user_stats.leetcode_solved = lc_solved if lc_solved is not None else 0
        user_stats.rating_history = [RatingHistory(**entry) for entry in processed_history]
    await sync_to_async(user_stats.save)()

    context = {
        "username": username,
        "codeforces_rating": user_stats.codeforces_rating if user_stats.codeforces_rating is not None else "N/A",
        "codechef_rating": user_stats.codechef_rating if user_stats.codechef_rating is not None else "N/A",
        "leetcode_solved": user_stats.leetcode_solved if user_stats.leetcode_solved is not None else 0,
        "rating_history": processed_history
    }

    return await sync_to_async(render)(request, "tracker/stats.html", context)


@login_required
async def fetch_user_rating_history(request, username):
    logged_in_username = await sync_to_async(lambda: request.user.username)()
    if logged_in_username != username:
        return JsonResponse({"error": "Unauthorized access"}, status=403)

    user_stats = await sync_to_async(UserStats.objects(username=username).no_cache().first)()
    if not user_stats:
        return JsonResponse({"error": f"User {username} not found"}, status=404)

    cache_key = f"rating_history_{username}"
    history = await sync_to_async(cache.get)(cache_key)
    lc_solved = user_stats.leetcode_solved

    if not history:
        print(f"Fetching fresh data for {username}")
        history, lc_solved = await fetch_and_store_rating_history_async(username)
        await sync_to_async(cache.set)(cache_key, history, timeout=None)

    # Ensure history is a list before sorting
    if isinstance(history, dict):
        # If history is a dict, try to extract a list from a known key or values
        history = history.get('rating_history', []) if 'rating_history' in history else list(history.values())
    elif not isinstance(history, list):
        print(f"Unexpected history type for {username}: {type(history)}")
        history = []  # Fallback to empty list if type is unrecognized

    # Sort history by date and take the most recent 50 entries
    if history:  # Only sort if there’s data
        try:
            history.sort(key=lambda x: x.date if hasattr(x, 'date') else x.get('date', datetime.min) or datetime.min, reverse=True)
            history = history[:50]  # Latest 50 entries (reverse=True sorts latest first)
        except AttributeError as e:
            print(f"Error sorting history for {username}: {e}")
            # Fallback: assume dict entries and sort by 'date' key
            history.sort(key=lambda x: x.get('date', datetime.min.isoformat()), reverse=True)
            history = history[:50]

    processed_history = []
    for entry in history:
        # Handle both RatingHistory objects and dictionaries
        if hasattr(entry, 'to_mongo'):  # Convert RatingHistory object to dict
            entry = entry.to_mongo().to_dict()
        entry_dict = {
            "platform": entry.get('platform', ''),
            "contest": entry.get('contest', ''),
            "old_rating": entry.get('old_rating', 0),
            "new_rating": entry.get('new_rating', 0),
            "rank": entry.get('rank', 0),
            "change": entry.get('change', 0),
            "date": entry.get('date', "1970-01-01T00:00:00")
        }
        processed_history.append(entry_dict)

    user_stats.codeforces_rating = max((h["new_rating"] for h in processed_history if h["platform"] == "Codeforces"),
                                       default=0)
    user_stats.leetcode_solved = lc_solved if lc_solved is not None else 0
    user_stats.codechef_rating = max((h["new_rating"] for h in processed_history if h["platform"] == "Codechef"),
                                     default=0)
    user_stats.rating_history = [RatingHistory(**entry) for entry in processed_history]
    await sync_to_async(user_stats.save)()

    compare_username = request.GET.get("compare_to", "").strip()
    compare_history = []
    if compare_username and compare_username != username:
        print(f"Fetching comparison data for {compare_username}")
        compare_user_stats = await sync_to_async(UserStats.objects(username=compare_username).no_cache().first)()
        if compare_user_stats:
            compare_cache_key = f"rating_history_{compare_username}"
            compare_history_raw = await sync_to_async(cache.get)(compare_cache_key)
            if not compare_history_raw:
                compare_history_raw, compare_lc_solved = await fetch_and_store_rating_history_async(compare_username)
                await sync_to_async(cache.set)(compare_cache_key, compare_history_raw, timeout=None)
            else:
                compare_lc_solved = compare_user_stats.leetcode_solved

            # Ensure compare_history_raw is a list
            if isinstance(compare_history_raw, dict):
                compare_history_raw = compare_history_raw.get('rating_history', []) if 'rating_history' in compare_history_raw else list(compare_history_raw.values())
            elif not isinstance(compare_history_raw, list):
                print(f"Unexpected compare_history type for {compare_username}: {type(compare_history_raw)}")
                compare_history_raw = []

            if compare_history_raw:
                try:
                    compare_history_raw.sort(key=lambda x: x.date if hasattr(x, 'date') else x.get('date', datetime.min) or datetime.min, reverse=True)
                    compare_history_raw = compare_history_raw[:50]
                except AttributeError as e:
                    print(f"Error sorting compare_history for {compare_username}: {e}")
                    compare_history_raw.sort(key=lambda x: x.get('date', datetime.min.isoformat()), reverse=True)
                    compare_history_raw = compare_history_raw[:50]

            for entry in compare_history_raw:
                if hasattr(entry, 'to_mongo'):
                    entry = entry.to_mongo().to_dict()
                entry_dict = {
                    "platform": entry.get('platform', ''),
                    "contest": entry.get('contest', ''),
                    "old_rating": entry.get('old_rating', 0),
                    "new_rating": entry.get('new_rating', 0),
                    "rank": entry.get('rank', 0),
                    "change": entry.get('change', 0),
                    "date": entry.get('date', "1970-01-01T00:00:00")
                }
                compare_history.append(entry_dict)

            compare_user_stats.codeforces_rating = max(
                (h["new_rating"] for h in compare_history if h["platform"] == "Codeforces"), default=0)
            compare_user_stats.leetcode_solved = compare_lc_solved
            compare_user_stats.codechef_rating = max(
                (h["new_rating"] for h in compare_history if h["platform"] == "Codechef"), default=0)
            compare_user_stats.rating_history = [RatingHistory(**entry) for entry in compare_history]
            await sync_to_async(compare_user_stats.save)()
        else:
            compare_history = []

    return JsonResponse({
        "user1": {
            "username": username,
            "rating_history": processed_history
        },
        "compare_to": {
            "username": compare_username,
            "rating_history": compare_history
        } if compare_username else None
    })


@login_required
async def compare_performance(request):
    print(f"Accessing performance page for logged-in user")

    user = request.user
    if not user.is_authenticated:
        return await sync_to_async(render)(request, "tracker/error.html",
                                           {"message": "Please log in to view performance trends"})

    user_stats = await sync_to_async(UserStats.objects(username=user.username).no_cache().first)()
    if not user_stats:
        user_stats = UserStats(username=user.username)
        await sync_to_async(user_stats.save)()

    context = {
        "user": user_stats,
        "username": user.username,
    }

    return await sync_to_async(render)(request, "tracker/performance.html", context)


def user_performance_view(request, username):
    if not username:
        return render(request, "tracker/performance.html", {"error": "Username is missing"})
    user = UserStats.objects(username=username).first()
    if not user:
        return render(request, "tracker/performance.html", {"error": "User not found"})
    return render(request, "tracker/performance.html", {"username": username, "user": user})


@login_required
def user_stats(request, username):
    if username != request.user.username:
        return redirect('tracker:user_stats', username=request.user.username)

    stats = UserStats.objects(username=username).first()
    if not stats:
        return render(request, 'tracker/stats.html', {'message': 'User stats not found.', 'username': username})

    cache_key = f"rating_history_{username}"
    rating_history = cache.get(cache_key)

    if not rating_history:
        rating_history, leetcode_solved = fetch_and_store_rating_history(username)
        cache.set(cache_key, rating_history, timeout=None)
    else:
        leetcode_solved = stats.leetcode_solved

    rating_history.sort(key=lambda x: x.date or datetime.min)
    rating_history = rating_history[-50:]

    codeforces_rating = stats.codeforces_rating if stats.codeforces_rating is not None else "N/A"
    codechef_rating = stats.codechef_rating if stats.codechef_rating is not None else "N/A"

    return render(request, 'tracker/stats.html', {
        'username': username,
        'codeforces_rating': codeforces_rating,
        'leetcode_solved': leetcode_solved,
        'codechef_rating': codechef_rating,
        'rating_history': rating_history,
    })