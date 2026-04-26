# tracker/views/auth_views.py
"""
Upgraded auth views:
  • Signup auto-creates UserProfile + sends email verification token
  • Login: redirects to `next`, flashes welcome message,
           warns if email unverified (doesn't block access)
  • Logout: flash goodbye
  • verify_email: one-click email confirmation link

EMAIL SETUP — add to settings.py + .env:
  Dev (prints to terminal):
      EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

  Production (Gmail example):
      EMAIL_BACKEND     = 'django.core.mail.backends.smtp.EmailBackend'
      EMAIL_HOST        = 'smtp.gmail.com'
      EMAIL_PORT        = 587
      EMAIL_USE_TLS     = True
      EMAIL_HOST_USER   = os.getenv('EMAIL_HOST_USER')
      EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
      DEFAULT_FROM_EMAIL = 'CodeCracker <noreply@codecracker.io>'
"""

import hashlib, hmac, time, os
from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.models import User
from django.contrib import messages
from django.core.mail import send_mail
from django.conf import settings
from django.core.cache import cache
from tracker.models import UserProfile


# ─── Token helpers ────────────────────────────────────────────────────────────

_SECRET = os.getenv("DJANGO_SECRET_KEY", "dev-secret")

def _make_verification_token(username: str) -> str:
    """HMAC-based token that expires in 24h (stored in Redis)."""
    token = hmac.new(_SECRET.encode(), username.encode(), hashlib.sha256).hexdigest()
    cache.set(f"email_verify_{username}", token, timeout=86400)
    return token

def _check_verification_token(username: str, token: str) -> bool:
    stored = cache.get(f"email_verify_{username}")
    if stored and hmac.compare_digest(stored, token):
        cache.delete(f"email_verify_{username}")
        return True
    return False

def _send_verification_email(request, user):
    try:
        token = _make_verification_token(user.username)
        link  = request.build_absolute_uri(
            f"/verify-email/{user.username}/{token}/"
        )
        send_mail(
            subject="Verify your CodeCracker email",
            message=f"Hi {user.username},\n\nClick the link below to verify your email:\n{link}\n\n"
                    "This link expires in 24 hours.\n\n— CodeCracker Team",
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@codecracker.io"),
            recipient_list=[user.email],
            fail_silently=True,
        )
    except Exception as e:
        print(f"[email] verification send failed: {e}")


# ─── Views ────────────────────────────────────────────────────────────────────

def signup_view(request):
    if request.user.is_authenticated:
        return redirect("tracker:home")

    if request.method == "POST":
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            UserProfile.get_or_create(user.username)
            # Create a UserStats entry in MongoDB so they appear on leaderboard
            from tracker.models import UserStats
            if not UserStats.objects(username=user.username).first():
                UserStats(username=user.username).save()
            login(request, user)

            if user.email:
                _send_verification_email(request, user)
                messages.info(
                    request,
                    f"🎉 Welcome, {user.username}! Check your email to verify your account."
                )
            else:
                messages.success(request, f"🎉 Welcome to CodeCracker, {user.username}!")

            return redirect("tracker:home")
    else:
        form = UserCreationForm()

    return render(request, "tracker/signup.html", {"form": form})


def login_view(request):
    if request.user.is_authenticated:
        return redirect("tracker:home")

    if request.method == "POST":
        form = AuthenticationForm(data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            # Lazily create profile if it doesn't exist (pre-upgrade users)
            profile = UserProfile.get_or_create(user.username)
            # Ensure UserStats exists in MongoDB (covers pre-existing users)
            from tracker.models import UserStats
            if not UserStats.objects(username=user.username).first():
                UserStats(username=user.username).save()

            if user.email and not cache.get(f"email_verified_{user.username}"):
                messages.warning(
                    request,
                    "⚠️ Your email isn't verified yet. "
                    '<a href="/resend-verification/">Resend verification email</a>'
                )

            messages.success(request, f"👋 Welcome back, {user.username}!")
            return redirect(request.GET.get("next", "/"))
        else:
            messages.error(request, "❌ Invalid username or password.")
    else:
        form = AuthenticationForm()

    return render(request, "tracker/login.html", {"form": form})


def logout_view(request):
    name = request.user.username if request.user.is_authenticated else ""
    logout(request)
    if name:
        messages.info(request, f"👋 See you soon, {name}!")
    return redirect("/")


def verify_email_view(request, username, token):
    """Confirms the email verification link."""
    if _check_verification_token(username, token):
        cache.set(f"email_verified_{username}", True, timeout=None)
        try:
            user = User.objects.get(username=username)
            user.email = user.email  # mark as confirmed (already set)
            user.save()
        except User.DoesNotExist:
            pass
        messages.success(request, "✅ Email verified! Your account is fully activated.")
    else:
        messages.error(request, "❌ This verification link is invalid or has expired.")
    return redirect("tracker:home")


def resend_verification_view(request):
    """Resends the verification email to the logged-in user."""
    if not request.user.is_authenticated:
        return redirect("tracker:login")
    if request.user.email:
        _send_verification_email(request, request.user)
        messages.success(request, "📧 Verification email resent! Check your inbox.")
    else:
        messages.warning(request, "⚠️ No email address on file. Please update your profile.")
    return redirect("tracker:profile")
