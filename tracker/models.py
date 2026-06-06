# tracker/models.py
"""
UserStats  — rating data, history, handles_hash for stale-detection
UserProfile — platform handles, bio, avatar, RBAC role, leaderboard toggle

Sync contract:
  - Both documents are always created together via UserStats.get_or_create()
  - UserStats.handles_hash stores an MD5 of the four resolved handles
  - If handles change in UserProfile, handles_hash mismatch forces a refetch
    even when Redis cache is still warm
"""
import hashlib
from mongoengine import (
    Document, EmbeddedDocument,
    StringField, IntField, ListField,
    EmbeddedDocumentField, DateTimeField, BooleanField
)
from datetime import datetime

AVATAR_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
]

ROLES = ('user', 'moderator', 'admin')


class RatingHistory(EmbeddedDocument):
    platform   = StringField(required=True)
    contest    = StringField()
    old_rating = IntField()
    new_rating = IntField()
    date       = DateTimeField()
    rank       = IntField()
    change     = IntField()

    def to_dict(self):
        return {
            'platform':   self.platform,
            'contest':    self.contest,
            'old_rating': self.old_rating,
            'new_rating': self.new_rating,
            'date':       self.date.isoformat() if self.date else None,
            'rank':       self.rank,
            'change':     self.change,
        }


class UserProfile(Document):
    """
    Extended user profile — linked to Django User by username.

    Platform handles allow a user's Django login name to differ from their
    competitive programming handles (very common in practice).

    role field powers RBAC:
      'user'      — can view own stats, compare, leaderboard
      'moderator' — can view any user's stats, add/remove users
      'admin'     — full access including role management
    """
    username             = StringField(required=True, unique=True)

    # Platform handles (blank = fall back to username)
    codeforces_handle    = StringField(default='')
    leetcode_handle      = StringField(default='')
    codechef_handle      = StringField(default='')
    atcoder_handle       = StringField(default='')

    # Display
    bio                  = StringField(default='', max_length=200)
    avatar_color         = StringField(default='#6366f1')
    show_on_leaderboard  = BooleanField(default=True)

    # RBAC
    role                 = StringField(default='user', choices=ROLES)

    created_at           = DateTimeField(default=datetime.utcnow)
    updated_at           = DateTimeField(default=datetime.utcnow)

    meta = {'collection': 'user_profiles', 'strict': False}

    def save(self, *args, **kwargs):
        self.updated_at = datetime.utcnow()
        super().save(*args, **kwargs)

    # ── Handle resolution ─────────────────────────────────────────
    # Single source of truth — all fetchers must use these methods
    def get_codeforces_handle(self): return self.codeforces_handle.strip() or self.username
    def get_leetcode_handle(self):   return self.leetcode_handle.strip()   or self.username
    def get_codechef_handle(self):   return self.codechef_handle.strip()   or self.username
    def get_atcoder_handle(self):    return self.atcoder_handle.strip()    or self.username

    def handles_hash(self):
        """MD5 of resolved handles — used by UserStats to detect stale data."""
        key = "|".join([
            self.get_codeforces_handle(),
            self.get_leetcode_handle(),
            self.get_codechef_handle(),
            self.get_atcoder_handle(),
        ])
        return hashlib.md5(key.encode()).hexdigest()

    # ── RBAC helpers ──────────────────────────────────────────────
    @property
    def is_admin(self):      return self.role == 'admin'
    @property
    def is_moderator(self):  return self.role in ('admin', 'moderator')

    @classmethod
    def get_or_create(cls, username):
        import random
        profile = cls.objects(username=username).first()
        if not profile:
            profile = cls(
                username=username,
                avatar_color=random.choice(AVATAR_COLORS)
            )
            profile.save()
        return profile


class UserStats(Document):
    username          = StringField(required=True, unique=True)
    codeforces_rating = IntField(default=0)
    leetcode_solved   = IntField(default=0)
    codechef_rating   = IntField(default=0)
    atcoder_rating    = IntField(default=0)
    rating_history    = ListField(EmbeddedDocumentField(RatingHistory))
    last_updated      = DateTimeField(default=datetime.utcnow)

    # Stores MD5 of resolved handles at last fetch time.
    # If UserProfile.handles_hash() differs from this value,
    # the fetcher ignores Redis cache and refetches immediately.
    handles_hash      = StringField(default='')

    meta = {'collection': 'user_stats', 'strict': False}

    def save(self, *args, **kwargs):
        self.last_updated = datetime.utcnow()
        super().save(*args, **kwargs)

    def is_stale(self, profile):
        """
        Returns True if platform handles have changed since last fetch.
        Callers should trigger a fresh fetch when this returns True,
        bypassing the Redis cache.
        """
        return self.handles_hash != profile.handles_hash()

    @classmethod
    def get_or_create(cls, username):
        """
        Always creates both UserStats and UserProfile together.
        Never call UserStats(username=...).save() directly — use this.
        """
        stats = cls.objects(username=username).first()
        if not stats:
            stats = cls(username=username)
            stats.save()
        # Ensure matching profile always exists
        UserProfile.get_or_create(username)
        return stats
