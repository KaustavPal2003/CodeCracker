# tracker/migrations/update_userstats.py
import os
import urllib.parse
from mongoengine import connect
from tracker.models import UserStats
from datetime import datetime

# Global connection flag
_MONGO_CONNECTED = False


def connect_to_mongodb():
    """Establish connection to MongoDB with error handling."""
    global _MONGO_CONNECTED
    if _MONGO_CONNECTED:
        return  # Already connected

    username = os.getenv('MONGO_USERNAME')
    password = os.getenv('MONGO_PASSWORD')

    if not username or not password:
        raise ValueError(
            "MONGO_USERNAME and MONGO_PASSWORD environment variables must be set."
        )

    # URL encode the credentials
    username = urllib.parse.quote_plus(username)
    password = urllib.parse.quote_plus(password)

    # Construct MongoDB URI
    mongo_uri = (
        f"mongodb+srv://{username}:{password}@cluster1.3mai1.mongodb.net/"
        f"codecracker_db?retryWrites=true&w=majority"
    )

    try:
        # Connect to MongoDB
        connect(host=mongo_uri, alias='default', db='codecracker')
        print("✅ Successfully connected to MongoDB!")
        _MONGO_CONNECTED = True
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {str(e)}")
        raise


def update_user_stats():
    """Update all UserStats documents with last_updated field."""
    try:
        # Ensure we're connected to MongoDB
        connect_to_mongodb()

        # Counter for updates
        updated_count = 0
        total_count = UserStats.objects.count()

        # Update all UserStats documents
        for user in UserStats.objects:
            if not hasattr(user, 'last_updated') or user.last_updated is None:
                user.last_updated = datetime.utcnow()
                user.save()
                updated_count += 1

        print(f"Migration completed: Updated {updated_count} out of {total_count} UserStats documents.")

    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        raise


if __name__ == "__main__":
    update_user_stats()

'''set MONGO_USERNAME=kaustabpal88
set MONGO_PASSWORD=J3NhCZ%Ji9AwDe%'''