# tracker/views/dashboard_views.py
from django.shortcuts import render
from tracker.models import UserStats


def dashboard_view(request):
    # Optional: Fetch some user stats for display on the dashboard
    user_stats = None
    if request.user.is_authenticated:
        try:
            user_stats = UserStats.objects(username=request.user.username).first()
        except UserStats.DoesNotExist:
            user_stats = None
    context = {
        'user_stats': user_stats,
    }
    return render(request, 'tracker/dashboard.html', context)


def home(request):
    return render(request, "tracker/dashboard.html")