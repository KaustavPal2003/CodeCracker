# tracker/views/admin_views.py
"""
RBAC admin panel — accessible only to users with role='admin'.

Routes (add to urls.py):
  path('admin-panel/',        admin_panel_view,     name='admin_panel'),
  path('admin-panel/set-role/', set_user_role_view, name='set_user_role'),
  path('admin-panel/delete-user/', delete_user_view, name='delete_user'),
"""
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.contrib import messages
from django.contrib.auth.models import User as DjangoUser
from tracker.models import UserProfile, UserStats


def _require_admin(view_fn):
    """Decorator: blocks non-admins."""
    from functools import wraps
    @wraps(view_fn)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect("tracker:login")
        profile = UserProfile.get_or_create(request.user.username)
        if not profile.is_admin:
            messages.error(request, "🚫 Admin access required.")
            return redirect("tracker:home")
        return view_fn(request, *args, **kwargs)
    return wrapper


@login_required
@_require_admin
def admin_panel_view(request):
    """List all users with their roles and stats."""
    all_profiles = UserProfile.objects.all()
    all_stats    = {s.username: s for s in UserStats.objects.all()}

    rows = []
    for profile in all_profiles:
        stats = all_stats.get(profile.username)
        rows.append({
            "username":           profile.username,
            "role":               profile.role,
            "codeforces_rating":  getattr(stats, "codeforces_rating", 0) or 0,
            "leetcode_solved":    getattr(stats, "leetcode_solved",   0) or 0,
            "codechef_rating":    getattr(stats, "codechef_rating",   0) or 0,
            "atcoder_rating":     getattr(stats, "atcoder_rating",    0) or 0,
            "show_on_leaderboard": profile.show_on_leaderboard,
            "last_updated":       getattr(stats, "last_updated", None),
        })

    rows.sort(key=lambda r: r["username"].lower())

    return render(request, "tracker/admin_panel.html", {
        "rows":   rows,
        "total":  len(rows),
        "roles":  ("user", "moderator", "admin"),
    })


@login_required
@_require_admin
def set_user_role_view(request):
    """AJAX endpoint — POST {username, role}."""
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST only"}, status=405)

    import json
    try:
        data     = json.loads(request.body)
        username = data.get("username", "").strip()
        role     = data.get("role", "").strip()
    except (json.JSONDecodeError, AttributeError):
        return JsonResponse({"ok": False, "error": "Invalid JSON"}, status=400)

    if not username or role not in ("user", "moderator", "admin"):
        return JsonResponse({"ok": False, "error": "Bad parameters"}, status=400)

    # Prevent demoting yourself
    if username == request.user.username and role != "admin":
        return JsonResponse({"ok": False, "error": "Cannot demote yourself"}, status=400)

    profile = UserProfile.objects(username=username).first()
    if not profile:
        return JsonResponse({"ok": False, "error": "User not found"}, status=404)

    profile.role = role
    profile.save()
    return JsonResponse({"ok": True, "username": username, "role": role})


@login_required
@_require_admin
def delete_user_view(request):
    """AJAX endpoint — POST {username}. Deletes stats + profile (not Django User)."""
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST only"}, status=405)

    import json
    try:
        data     = json.loads(request.body)
        username = data.get("username", "").strip()
    except (json.JSONDecodeError, AttributeError):
        return JsonResponse({"ok": False, "error": "Invalid JSON"}, status=400)

    if not username or username == request.user.username:
        return JsonResponse({"ok": False, "error": "Cannot delete yourself"}, status=400)

    UserStats.objects(username=username).delete()
    UserProfile.objects(username=username).delete()

    # Also delete Django User if present
    DjangoUser.objects.filter(username=username).delete()

    return JsonResponse({"ok": True, "deleted": username})
