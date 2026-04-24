# tracker/views/leaderboard_views.py
import json
from django.shortcuts import render
from tracker.models import UserStats, UserProfile


def leaderboard_view(request):
    user_stats = UserStats.objects.all()
    leaderboard_data = []

    # Build a set of opted-out usernames (only exclude explicit opt-outs)
    try:
        opted_out = set(
            p.username for p in UserProfile.objects(show_on_leaderboard=False)
        )
    except Exception:
        opted_out = set()

    for stats in user_stats:
        # Skip only if explicitly opted out — users without a profile are visible
        if stats.username in opted_out:
            continue

        # Skip users with zero ratings across all platforms (placeholder entries)
        cf  = stats.codeforces_rating or 0
        lc  = stats.leetcode_solved   or 0
        cc  = stats.codechef_rating   or 0
        ac  = getattr(stats, 'atcoder_rating', 0) or 0

        if cf == 0 and lc == 0 and cc == 0 and ac == 0:
            continue

        total_score = round(
            (float(cf) * 0.35) +
            (float(lc) * 0.15) +
            (float(cc) * 0.25) +
            (float(ac) * 0.25),
            1
        )
        leaderboard_data.append({
            'username':          stats.username,
            'codeforces_rating': cf,
            'leetcode_solved':   lc,
            'codechef_rating':   cc,
            'atcoder_rating':    ac,
            'total_score':       total_score,
        })

    leaderboard_data.sort(key=lambda x: x['total_score'], reverse=True)

    return render(request, 'tracker/leaderboard.html', {
        'leaderboard_data':      leaderboard_data,
        'leaderboard_data_json': json.dumps(leaderboard_data),
    })
