# tracker/urls.py
from django.urls import path
from .views import api_views, auth_views, user_views

urlpatterns = [
    path('api/codechef/<str:username>/', api_views.fetch_codechef_history_view, name='fetch_codechef_history'),
    path('api/codeforces/<str:username>/', api_views.fetch_codeforces_history_view, name='fetch_codeforces_history'),
    path('api/contests/<str:username>/', api_views.fetch_all_contest_history_view, name='fetch_all_contest_history'),
    path('api/test-db/', api_views.test_db_connection, name='test_db_connection'),
path('stats/<str:username>/', user_views.fetch_user_stats, name='stats'),
    path('stats/<str:username>/', user_views.fetch_user_stats, name='fetch_user_stats'),  # Changed to user_views
    path('signup/', auth_views.signup_view, name='signup'),
    path('login/', auth_views.login_view, name='login'),
    path('logout/', auth_views.logout_view, name='logout'),

    path('add-user/', user_views.add_user, name='add_user'),
    path('performance/<str:username>/', user_views.user_performance_view, name='user_performance'),
    path('rating-history/<str:username>/', user_views.fetch_user_rating_history, name='fetch_user_rating_history'),
path('stats/<str:username>/', user_views.fetch_user_stats, name='user_stats'),
    path('performance/', user_views.compare_performance, name='compare_performance'),
    path('rating-history/<str:username>/', user_views.fetch_user_rating_history, name='fetch_user_rating_history'),
path('compare/', user_views.compare_stats, name='compare_stats'),
path('stats/<str:username>/', user_views.user_stats, name='user_stats'),
path('leaderboard/', user_views.leaderboard_view, name='leaderboard'),
# urls.py
path('save_comparison/', user_views.save_comparison, name='save_comparison'),
# urls.py
path('', user_views.dashboard_view, name='home'),
]