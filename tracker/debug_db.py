import os
import sys
import django

# ✅ Add your Django project directory to system path
PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(PROJECT_DIR)

# ✅ Set Django settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "codecracker.settings")

# ✅ Initialize Django
django.setup()

# ✅ Now import models
from tracker.models import UserStats
from django.db import connection

# ✅ Check database connection
with connection.cursor() as cursor:
    cursor.execute("SELECT 1")
    print("✅ Database connection successful!")

# ✅ Fetch all user stats
users = UserStats.objects.all()
print("📊 Stored Users:", list(users))
