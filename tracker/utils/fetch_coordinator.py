# tracker/utils/fetch_coordinator.py
"""
Coordinates stat fetching for a given username.

Sync contract with models:
  1. Always resolves handles via UserProfile.get_*_handle() — never uses
     raw username as a handle directly.
  2. Always creates both UserStats and UserProfile via UserStats.get_or_create().
  3. Checks UserStats.is_stale(profile) — if handles changed since last fetch,
     bypasses Redis cache and forces a full refetch.
  4. After a successful fetch, writes profile.handles_hash() into
     UserStats.handles_hash so stale detection works next time.
"""
from asgiref.sync import sync_to_async
from tracker.models import UserStats, UserProfile
from .async_fetchers import fetch_and_store_rating_history_async
from .sync_fetchers import fetch_and_store_rating_history


async def fetch_and_store_all(username):
    """
    Main entry point for fetching all platform stats for a user.

    Steps:
      1. Load (or create) both UserProfile and UserStats together.
      2. Check if handles changed — if so, force refetch bypassing cache.
      3. Try async parallel fetch; fall back to sync sequential on error.
      4. Persist results and update handles_hash.
    """
    print(f"[coordinator] starting fetch for {username}")

    # ── Step 1: load profile and stats together ───────────────────
    profile = await sync_to_async(UserProfile.get_or_create)(username)
    user    = await sync_to_async(UserStats.get_or_create)(username)

    # ── Step 2: stale detection ───────────────────────────────────
    force_refetch = await sync_to_async(user.is_stale)(profile)
    if force_refetch:
        print(f"[coordinator] handles changed for {username} — forcing refetch")

    # Resolved handles from single source of truth
    cf_handle = await sync_to_async(profile.get_codeforces_handle)()
    lc_handle = await sync_to_async(profile.get_leetcode_handle)()
    cc_handle = await sync_to_async(profile.get_codechef_handle)()
    ac_handle = await sync_to_async(profile.get_atcoder_handle)()

    print(f"[coordinator] handles — CF:{cf_handle} LC:{lc_handle} CC:{cc_handle} AC:{ac_handle}")

    # ── Step 3: fetch ─────────────────────────────────────────────
    try:
        history, lc_solved = await fetch_and_store_rating_history_async(
            username,
            cf_handle=cf_handle,
            lc_handle=lc_handle,
            cc_handle=cc_handle,
            ac_handle=ac_handle,
        )
        print(f"[coordinator] async fetch succeeded — {len(history)} entries")
    except Exception as e:
        print(f"[coordinator] async fetch failed ({e}), falling back to sync")
        history, lc_solved = await sync_to_async(fetch_and_store_rating_history)(
            username,
            cf_handle=cf_handle,
            lc_handle=lc_handle,
            cc_handle=cc_handle,
            ac_handle=ac_handle,
        )
        print(f"[coordinator] sync fallback succeeded — {len(history)} entries")

    # ── Step 4: persist and update handles_hash ───────────────────
    current_hash = await sync_to_async(profile.handles_hash)()

    def _save():
        u = UserStats.objects(username=username).first() or UserStats(username=username)
        u.rating_history    = history
        u.leetcode_solved   = lc_solved
        u.codeforces_rating = max((h.new_rating for h in history if h.platform == "Codeforces"), default=0)
        u.codechef_rating   = max((h.new_rating for h in history if h.platform == "CodeChef"),   default=0)
        u.atcoder_rating    = max((h.new_rating for h in history if h.platform == "AtCoder"),    default=0)
        u.handles_hash      = current_hash   # mark as fresh for these handles
        u.save()

    await sync_to_async(_save)()
    print(f"[coordinator] saved stats for {username}, handles_hash={current_hash[:8]}…")

    return user
