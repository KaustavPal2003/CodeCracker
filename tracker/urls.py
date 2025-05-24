# tracker/urls.py
from django.urls import path

from .views import comparison_views
from .views.api_views import (
    get_suggestions,
    fetch_codechef_history_view,
    fetch_codeforces_history_view,
    fetch_all_contest_history_view,
    test_db_connection,
)
from .views.auth_views import signup_view, login_view, logout_view
from .views.dashboard_views import dashboard_view
from .views.leaderboard_views import leaderboard_view
from .views.stats_views import (
    fetch_user_stats,
    fetch_user_rating_history,
    user_performance_view,
    user_stats,
    compare_performance,
)
from .views.comparison_views import compare_stats, save_comparison, check_user_status
from .views.user_management_views import add_user

app_name = 'tracker'  # Namespace for the app

urlpatterns = [
    # API endpoints
    path('api/suggestions/', get_suggestions, name='get_suggestions'),
    path('api/codechef/<str:username>/', fetch_codechef_history_view, name='fetch_codechef_history'),
    path('api/codeforces/<str:username>/', fetch_codeforces_history_view, name='fetch_codeforces_history'),
    path('api/contests/<str:username>/', fetch_all_contest_history_view, name='fetch_all_contest_history'),
    path('api/test-db/', test_db_connection, name='test_db_connection'),

    # Authentication views
    path('signup/', signup_view, name='signup'),
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),

    # Dashboard and home
    path('', dashboard_view, name='home'),  # Dashboard view as the homepage

    # Leaderboard
    path('leaderboard/', leaderboard_view, name='leaderboard'),

    # User stats and performance
    path('stats/<str:username>/', fetch_user_stats, name='fetch_user_stats'),  # Fetch user stats (async)
    path('user-stats/<str:username>/', user_stats, name='user_stats'),  # Sync version of user stats
    path('performance/<str:username>/', user_performance_view, name='user_performance'),
    path('compare-performance/', compare_performance, name='compare_performance'),

    path('check_status/<str:username>/', check_user_status, name='check_user_status'),
    path('rating-history/<str:username>/', fetch_user_rating_history, name='fetch_user_rating_history'),

    # Comparison
    path('compare/', compare_stats, name='compare_stats'),
    path('save-comparison/', save_comparison, name='save_comparison'),

    # User management
    path('add-user/', add_user, name='add_user'),
]