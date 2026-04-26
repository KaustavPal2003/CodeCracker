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
    # Check MongoDB UserStats first (works even if Django DB was reset)
    user = UserStats.objects(username=username).first()

    # Also accept if Django user exists but has no stats yet
    django_exists = User.objects.filter(username=username).exists()

    if not user and not django_exists:
        return False, {"exists_in_sqlite": False, "message": "User does not exist in the system"}, 404

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
def compare_stats_api(request):
    """HTTP fallback endpoint when WebSocket is unavailable."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    try:
        data = json.loads(request.body)
        u1 = data.get('user1_username', '').strip()
        u2 = data.get('user2_username', '').strip()
        if not u1 or not u2:
            return JsonResponse({'error': 'Both usernames required'}, status=400)

        from tracker.utils.sync_fetchers import fetch_and_store_rating_history

        def build_user_data(username):
            history, lc_solved = fetch_and_store_rating_history(username)
            rating_history = [h.to_dict() for h in history] if history else []
            stats = UserStats.objects(username=username).first()
            lc_history = [h for h in rating_history if h.get('platform') == 'LeetCode']
            lc_rating = max((h.get('new_rating', 0) for h in lc_history), default=None)
            return {
                'username': username,
                'codeforces_rating': stats.codeforces_rating if stats else 0,
                'leetcode_solved': lc_solved or 0,
                'leetcode_rating': lc_rating,
                'codechef_rating': stats.codechef_rating if stats else 0,
                'atcoder_rating': stats.atcoder_rating if stats else 0,
                'rating_history': rating_history[-50:],
            }

        user1_data = build_user_data(u1)
        user2_data = build_user_data(u2)
        return JsonResponse({'user1': user1_data, 'compare_to': user2_data})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


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
               'username': username,
               'codeforces_rating': stats.codeforces_rating if stats.codeforces_rating is not None else "N/A",
               'leetcode_solved': leetcode_solved or 0,
               'leetcode_rating': leetcode_rating if leetcode_rating is not None else "N/A",
               'leetcode_contests': len(leetcode_history),
               'codechef_rating': stats.codechef_rating if stats.codechef_rating is not None else "N/A",
               'rating_history': rating_history[-50:],  # Limit to last 50 entries
           }
           cache.set(cache_key, user_data, timeout=86400)  # Cache for 24 hours
       except Exception as e:
           return render(request, 'tracker/compare.html', {
               'message': f'Error fetching user stats: {str(e)}',
               'username': username
           })
   else:
       user_data = cached_data

   return render(request, 'tracker/compare.html', {
       'username': user_data['username'],
       'codeforces_rating': user_data['codeforces_rating'],
       'leetcode_solved': user_data['leetcode_solved'],
       'leetcode_rating': user_data['leetcode_rating'],
       'leetcode_contests': user_data['leetcode_contests'],
       'codechef_rating': user_data['codechef_rating'],
       'rating_history': user_data['rating_history'],
   })