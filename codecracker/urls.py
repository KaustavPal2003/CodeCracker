# codecracker/urls.py
from django.contrib import admin
from django.urls import path, include

# URL patterns for the project
urlpatterns = [
    path('admin/', admin.site.urls),  # Admin site URL
    path('', include('tracker.urls')),  # Include app routes from the tracker app
    # Password reset lives here (no namespace) so template {% url 'password_reset' %} works
    path('password-reset/', include('django.contrib.auth.urls')),
]

# Add Debug Toolbar URLs if DEBUG is True
from django.conf import settings
if settings.DEBUG:
    try:
        import debug_toolbar
        urlpatterns += [
            path('__debug__/', include(debug_toolbar.urls)),  # Debug toolbar URL
        ]
    except ImportError:
        pass  # debug_toolbar not installed in production — skip silently
