import os
from celery import Celery

# Set the default settings module for the 'django' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "codecracker.settings")

# Create a Celery application instance
celery_app = Celery("codecracker")

# Load configuration from Django settings, using the CELERY namespace
celery_app.config_from_object("django.conf:settings", namespace="CELERY")

# Automatically discover tasks in all registered Django app configs
celery_app.autodiscover_tasks()
