import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "codecracker.settings")

app = Celery("codecracker")

app.config_from_object("django.conf:settings", namespace="CELERY")

# Directly override broker from environment so it always takes effect
redis_url = os.environ.get("REDIS_URL") or os.environ.get("CELERY_BROKER_URL")
if redis_url:
    app.conf.broker_url = redis_url

app.autodiscover_tasks()
