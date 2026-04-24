# tracker/views/profile_views.py
"""
Profile page:
  • Edit platform handles (CF, LC, CC, AtCoder)
  • Bio, avatar colour, leaderboard toggle
  • Cache invalidation on save
  • Admin-only: view any user's profile via ?user=
"""
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.contrib import messages
from django.core.cache import cache
from tracker.models import UserProfile, UserStats, AVATAR_COLORS


@login_required
def profile_view(request):
    # Admins can inspect any user via ?user=xxx
    target_username = request.GET.get("user", request.user.username).strip()
    own_profile     = target_username == request.user.username

    my_profile = UserProfile.get_or_create(request.user.username)

    if not own_profile and not my_profile.is_admin:
        messages.error(request, "🚫 You don't have permission to view that profile.")
        return redirect("tracker:profile")

    profile = UserProfile.get_or_create(target_username)
    stats   = UserStats.objects(username=target_username).first()

    if request.method == "POST" and (own_profile or my_profile.is_admin):
        cf_handle  = request.POST.get("codeforces_handle", "").strip()[:50]
        lc_handle  = request.POST.get("leetcode_handle",   "").strip()[:50]
        cc_handle  = request.POST.get("codechef_handle",   "").strip()[:50]
        ac_handle  = request.POST.get("atcoder_handle",    "").strip()[:50]
        bio        = request.POST.get("bio",               "").strip()[:200]
        color      = request.POST.get("avatar_color",      profile.avatar_color)
        on_board   = request.POST.get("show_on_leaderboard") == "yes"

        # Admin-only: change role
        if my_profile.is_admin and not own_profile:
            new_role = request.POST.get("role", profile.role)
            if new_role in ("user", "moderator", "admin"):
                profile.role = new_role

        if color not in AVATAR_COLORS:
            color = profile.avatar_color

        profile.codeforces_handle   = cf_handle
        profile.leetcode_handle     = lc_handle
        profile.codechef_handle     = cc_handle
        profile.atcoder_handle      = ac_handle
        profile.bio                 = bio
        profile.avatar_color        = color
        profile.show_on_leaderboard = on_board
        profile.save()

        # Bust caches so next page load fetches fresh data
        for key in (f"rating_history_{target_username}",
                    f"user_stats_{target_username}",
                    f"atcoder_history_{ac_handle or target_username}",
                    f"codechef_history_{cc_handle or target_username}"):
            cache.delete(key)

        messages.success(request, "✅ Profile saved!")
        return redirect(f"/profile/?user={target_username}" if not own_profile
                        else "tracker:profile")

    return render(request, "tracker/profile.html", {
        "profile":       profile,
        "stats":         stats,
        "avatar_colors": AVATAR_COLORS,
        "initials":      _initials(target_username),
        "own_profile":   own_profile,
        "is_admin":      my_profile.is_admin,
    })


def _initials(username: str) -> str:
    parts = username.replace("_", " ").replace("-", " ").split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return username[:2].upper()
