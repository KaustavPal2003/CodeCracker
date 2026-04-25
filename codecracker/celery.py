import os
from celery import Celery

# Set the default settings module for the 'django' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "codecracker.settings")

# Create a Celery application instance
app = Celery("codecracker")

# Load configuration from Django settings, using the CELERY namespace
app.config_from_object("django.conf:settings", namespace="CELERY")

# Automatically discover tasks in all registered Django app configs
app.autodiscover_tasks()
