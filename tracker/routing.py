from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/stats/(?P<username>\w+)/$', consumers.StatsConsumer.as_asgi()),
    re_path(r'ws/performance/(?P<username>\w+)/$', consumers.StatsConsumer.as_asgi()),
re_path(r'ws/leaderboard/$', consumers.LeaderboardConsumer.as_asgi()),
]