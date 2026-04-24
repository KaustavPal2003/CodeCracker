# tracker/urls.py  — full upgraded version
from django.urls import path, include

from .views.api_views import (
    get_suggestions, fetch_codechef_history_view,
    fetch_codeforces_history_view, fetch_all_contest_history_view,
    test_db_connection,
)
from .views.auth_views import (
    signup_view, login_view, logout_view,
    verify_email_view, resend_verification_view,
)
from .views.dashboard_views import dashboard_view
from .views.leaderboard_views import leaderboard_view
from .views.profile_views import profile_view
from .views.admin_views import (
    admin_panel_view, set_user_role_view, delete_user_view,
)
from .views.export_views import export_csv_view, export_pdf_view
from .views.stats_views import (
    fetch_user_stats, fetch_user_rating_history,
    user_performance_view, user_stats, compare_performance,
)
from .views.comparison_views import compare_stats, save_comparison, check_user_status
from .views.user_management_views import add_user

app_name = "tracker"

urlpatterns = [
    # ── API ──────────────────────────────────────────────────────────────
    path("api/suggestions/",              get_suggestions,               name="get_suggestions"),
    path("api/codechef/<str:username>/",  fetch_codechef_history_view,   name="fetch_codechef_history"),
    path("api/codeforces/<str:username>/",fetch_codeforces_history_view, name="fetch_codeforces_history"),
    path("api/contests/<str:username>/",  fetch_all_contest_history_view,name="fetch_all_contest_history"),
    path("api/test-db/",                  test_db_connection,            name="test_db_connection"),

    # ── Auth ─────────────────────────────────────────────────────────────
    path("signup/",       signup_view,             name="signup"),
    path("login/",        login_view,              name="login"),
    path("logout/",       logout_view,             name="logout"),
    path("verify-email/<str:username>/<str:token>/",
                          verify_email_view,       name="verify_email"),
    path("resend-verification/",
                          resend_verification_view,name="resend_verification"),


    # ── Dashboard ────────────────────────────────────────────────────────
    path("", dashboard_view, name="home"),

    # ── Profile ──────────────────────────────────────────────────────────
    path("profile/", profile_view, name="profile"),

    # ── Admin panel ──────────────────────────────────────────────────────
    path("admin-panel/",             admin_panel_view,   name="admin_panel"),
    path("admin-panel/set-role/",    set_user_role_view, name="set_user_role"),
    path("admin-panel/delete-user/", delete_user_view,   name="delete_user"),

    # ── Export ───────────────────────────────────────────────────────────
    path("export/csv/<str:username>/", export_csv_view, name="export_csv"),
    path("export/pdf/<str:username>/", export_pdf_view, name="export_pdf"),

    # ── Leaderboard ──────────────────────────────────────────────────────
    path("leaderboard/", leaderboard_view, name="leaderboard"),

    # ── Stats & performance ───────────────────────────────────────────────
    path("stats/<str:username>/",          fetch_user_stats,          name="fetch_user_stats"),
    path("user-stats/<str:username>/",     user_stats,                name="user_stats"),
    path("performance/<str:username>/",    user_performance_view,     name="user_performance"),
    path("compare-performance/",           compare_performance,       name="compare_performance"),
    path("check_status/<str:username>/",   check_user_status,         name="check_user_status"),
    path("rating-history/<str:username>/", fetch_user_rating_history, name="fetch_user_rating_history"),

    # ── Comparison ───────────────────────────────────────────────────────
    path("compare/",         compare_stats,   name="compare_stats"),
    path("save-comparison/", save_comparison, name="save_comparison"),

    # ── User management ──────────────────────────────────────────────────
    path("add-user/", add_user, name="add_user"),
]
