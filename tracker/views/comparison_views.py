# tracker/views/comparison_views.py
from datetime import datetime

from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.http import JsonResponse
from django.core.cache import cache
from tracker.models import UserStats
from tracker.utils.sync_fetchers import fetch_and_store_rating_history
from mongoengine import Document, StringField
import json


class SavedComparison(Document):
    username = StringField(required=True)
    compare_to = StringField(required=True)
    meta = {'collection': 'saved_comparisons'}


def save_comparison(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username')
        compare_to = data.get('compare_to')
        if username and compare_to:
            SavedComparison(username=username, compare_to=compare_to).save()
            return JsonResponse({'success': True})
        return JsonResponse({'success': False, 'error': 'Invalid data'}, status=400)
    return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)


@login_required
def compare_stats(request):
    username = request.user.username
    stats = UserStats.objects(username=username).first()
    if not stats:
        return render(request, 'tracker/compare.html', {'message': 'User stats not found.', 'username': username})

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

    return render(request, 'tracker/compare.html', {
        'username': username,
        'codeforces_rating': codeforces_rating,
        'leetcode_solved': leetcode_solved,
        'codechef_rating': codechef_rating,
        'rating_history': rating_history,
    })