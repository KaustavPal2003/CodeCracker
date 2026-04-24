# tracker/models.py
"""
Upgraded models:
  • UserStats  — adds atcoder_rating field (backward-compatible default=0)
  • UserProfile — NEW: platform handles, bio, avatar, RBAC role, leaderboard toggle
"""
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


class UserStats(Document):
    username          = StringField(required=True, unique=True)
    codeforces_rating = IntField(default=0)
    leetcode_solved   = IntField(default=0)
    codechef_rating   = IntField(default=0)
    atcoder_rating    = IntField(default=0)   # ← NEW
    rating_history    = ListField(EmbeddedDocumentField(RatingHistory))
    last_updated      = DateTimeField(default=datetime.utcnow)

    meta = {'collection': 'user_stats', 'strict': False}

    def save(self, *args, **kwargs):
        if not self.last_updated:
            self.last_updated = datetime.utcnow()
        super().save(*args, **kwargs)


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
    atcoder_handle       = StringField(default='')    # ← NEW

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
    def get_codeforces_handle(self):  return self.codeforces_handle or self.username
    def get_leetcode_handle(self):    return self.leetcode_handle   or self.username
    def get_codechef_handle(self):    return self.codechef_handle   or self.username
    def get_atcoder_handle(self):     return self.atcoder_handle    or self.username

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
            profile = cls(username=username,
                          avatar_color=random.choice(AVATAR_COLORS))
            profile.save()
        return profile
