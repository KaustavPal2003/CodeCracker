# tracker/utils/tasks.py
from celery import shared_task
from .sync_fetchers import fetch_and_store_user_stats, fetch_and_store_rating_history

@shared_task
def fetch_and_store_user_stats_task(username):
    return fetch_and_store_user_stats(username)

@shared_task
def fetch_and_store_rating_history_task(username):
    return fetch_and_store_rating_history(username)