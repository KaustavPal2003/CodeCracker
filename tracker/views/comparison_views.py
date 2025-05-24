# tracker/views/comparison_views.py
from datetime import datetime
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.core.cache import cache
from django.http import JsonResponse
from django.contrib.auth.models import User
from mongoengine import Document, StringField
import json
from tracker.utils.sync_fetchers import fetch_and_store_rating_history
from tracker.models import UserStats

class SavedComparison(Document):
    username = StringField(required=True)
    compare_to = StringField(required=True)
    meta = {'collection': 'saved_comparisons'}

def validate_user(username):
    """Validate if a user exists and has valid ratings."""
    if not User.objects.filter(username=username).exists():
        return False, {"exists_in_sqlite": False, "message": "User does not exist in the system"}, 404

    user = UserStats.objects(username=username).first()
    if not user:
        return False, {
            "exists_in_sqlite": True,
            "exists_in_mongodb": False,
            "has_valid_ratings": False,
            "message": "User stats not found in database"
        }, 404

    has_valid_ratings = (
        (user.codeforces_rating and user.codeforces_rating > 0) or
        (user.leetcode_solved and user.leetcode_solved > 0) or
        (user.codechef_rating and user.codechef_rating > 0) or
        any(rating.new_rating > 0 for rating in user.rating_history if hasattr(rating, 'new_rating'))
    )

    if not has_valid_ratings:
        return False, {
            "exists_in_sqlite": True,
            "exists_in_mongodb": True,
            "has_valid_ratings": False,
            "message": "User has no valid ratings or contest history"
        }, 400

    return True, {
        "exists_in_sqlite": True,
        "exists_in_mongodb": True,
        "has_valid_ratings": True,
        "message": "User is valid and has ratings"
    }, 200

@login_required
def check_user_status(request, username):
    try:
        is_valid, response_data, status = validate_user(username)
        return JsonResponse(response_data, status=status)
    except Exception as e:
        return JsonResponse({
            "exists_in_sqlite": False,
            "error": str(e),
            "message": "An error occurred while checking user status"
        }, status=500)

@login_required
def save_comparison(request):
   if request.method != 'POST':
       return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)

   try:
       data = json.loads(request.body)
       username = data.get('username')
       compare_to = data.get('compare_to')

       if not username or not compare_to:
           return JsonResponse({'success': False, 'error': 'Username and compare_to are required'}, status=400)

       if username == compare_to:
           return JsonResponse({'success': False, 'error': 'Cannot compare a user with themselves'}, status=400)

       # Validate both users
       is_valid1, _, _ = validate_user(username)
       is_valid2, _, _ = validate_user(compare_to)
       if not (is_valid1 and is_valid2):
           return JsonResponse({'success': False, 'error': 'One or both users are invalid'}, status=404)

       # Check for existing comparison
       if SavedComparison.objects(username=username, compare_to=compare_to).first():
           return JsonResponse({'success': False, 'error': 'Comparison already exists'}, status=400)

       SavedComparison(username=username, compare_to=compare_to).save()
       return JsonResponse({'success': True, 'message': 'Comparison saved successfully'})
   except json.JSONDecodeError:
       return JsonResponse({'success': False, 'error': 'Invalid JSON data'}, status=400)
   except Exception as e:
       return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
def compare_stats(request):
    username = request.user.username
    stats = UserStats.objects(username=username).first()
    if not stats:
        return render(request, 'tracker/compare.html', {
            'message': 'User stats not found. Please ensure your profile is set up correctly.',
            'username': username
        })

    cache_key = f"rating_history_{username}_{stats.last_updated.isoformat() if stats.last_updated else 'no_update'}"
    cached_data = cache.get(cache_key)

    user_data = {}
    if not cached_data:
        try:
            history, leetcode_solved = fetch_and_store_rating_history(username)
            rating_history = [h.to_dict() for h in history] if history else []
            leetcode_history = [h for h in rating_history if h.get('platform') == 'LeetCode']
            leetcode_rating = max(
                (h.get('new_rating', 0) for h in leetcode_history if h.get('new_rating') is not None),
                default=None
            ) if leetcode_history else None

            user_data = {
                'user1': {
                    'username': username,
                    'codeforces_rating': stats.codeforces_rating if stats.codeforces_rating is not None else "N/A",
                    'leetcode_solved': leetcode_solved or 0,
                    'leetcode_rating': leetcode_rating if leetcode_rating is not None else "N/A",
                    'leetcode_contests': len(leetcode_history),
                    'codechef_rating': stats.codechef_rating if stats.codechef_rating is not None else "N/A",
                    'rating_history': rating_history,  # Send all entries, no limit
                }
            }
            cache.set(cache_key, user_data, timeout=86400)
        except Exception as e:
            return render(request, 'tracker/compare.html', {
                'message': f'Error fetching user stats: {str(e)}',
                'username': username
            })
    else:
        user_data = cached_data

    return render(request, 'tracker/compare.html', user_data['user1'])