from mongoengine import Document, StringField, IntField, ListField, EmbeddedDocument, EmbeddedDocumentField, DateTimeField

from mongoengine import EmbeddedDocument, StringField, IntField, DateTimeField

class RatingHistory(EmbeddedDocument):
    platform = StringField(required=True)
    contest = StringField()
    old_rating = IntField()
    new_rating = IntField()
    date = DateTimeField()
    rank = IntField()
    change = IntField()

    def to_dict(self):
        return {
            'platform': self.platform,
            'contest': self.contest,
            'old_rating': self.old_rating,
            'new_rating': self.new_rating,
            'date': self.date.isoformat() if self.date else None,
            'rank': self.rank,
            'change': self.change
        }

class UserStats(Document):
    username = StringField(required=True, unique=True)
    codeforces_rating = IntField(default=0)
    leetcode_solved = IntField(default=0)
    codechef_rating = IntField(default=0)
    rating_history = ListField(EmbeddedDocumentField(RatingHistory))
    
    meta = {'collection': 'user_stats'}