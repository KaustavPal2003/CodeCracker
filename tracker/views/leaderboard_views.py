# tracker/views/leaderboard_views.py
from django.shortcuts import render
from tracker.models import UserStats


def leaderboard_view(request):
    # Fetch all user stats from the UserStats collection
    user_stats = UserStats.objects.all()
    leaderboard_data = []

    for stats in user_stats:
        # Calculate a total score (example: weighted sum)
        total_score = (
            (float(stats.codeforces_rating or 0) * 0.4) +
            (float(stats.leetcode_solved or 0) * 0.2) +
            (float(stats.codechef_rating or 0) * 0.4)
        )
        leaderboard_data.append({
            'username': stats.username,
            'codeforces_rating': stats.codeforces_rating,
            'leetcode_solved': stats.leetcode_solved,
            'codechef_rating': stats.codechef_rating,
            'total_score': total_score
        })

    # Sort by total_score in descending order
    leaderboard_data.sort(key=lambda x: x['total_score'], reverse=True)

    return render(request, 'tracker/leaderboard.html', {'leaderboard_data': leaderboard_data})