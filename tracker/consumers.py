from channels.generic.websocket import AsyncWebsocketConsumer
from tracker.utils.sync_fetchers import fetch_and_store_rating_history
from tracker.models import UserStats
from django.core.cache import cache
from asgiref.sync import sync_to_async
import json

class StatsConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.username = self.scope['url_route']['kwargs']['username']
        self.group_name = f'stats_{self.username}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_initial_data()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        self.compare_to = data.get('compare_to')
        force_refresh = data.get('force_refresh', False)  # Manual refresh flag
        await self.send_initial_data(force_refresh=force_refresh)

    async def send_initial_data(self, force_refresh=False):
        user_stats = await sync_to_async(UserStats.objects.filter(username=self.username).first)()
        if not user_stats:
            await self.send(text_data=json.dumps({'error': f'User stats not found for {self.username}.'}))
            return

        cache_key = f'rating_history_{self.username}'
        rating_history = await sync_to_async(cache.get)(cache_key) if not force_refresh else None

        if not rating_history:
            rating_history, leetcode_solved = await sync_to_async(fetch_and_store_rating_history)(self.username)
            await sync_to_async(cache.set)(cache_key, rating_history, timeout=86400)  # 24-hour cache
        else:
            leetcode_solved = user_stats.leetcode_solved if user_stats.leetcode_solved is not None else 0

        has_no_ratings = (
            (user_stats.codeforces_rating is None or user_stats.codeforces_rating == 0) and
            (user_stats.codechef_rating is None or user_stats.codechef_rating == 0) and
            leetcode_solved == 0 and
            (not rating_history or len(rating_history) == 0)
        )

        compare_rating_history = []
        leetcode_solved_compare = 0
        if self.compare_to:
            compare_stats = await sync_to_async(UserStats.objects.filter(username=self.compare_to).first)()
            if compare_stats:
                compare_cache_key = f'rating_history_{self.compare_to}'
                compare_rating_history = await sync_to_async(cache.get)(compare_cache_key) if not force_refresh else None
                if not compare_rating_history:
                    compare_rating_history, leetcode_solved_compare = await sync_to_async(fetch_and_store_rating_history)(self.compare_to)
                    await sync_to_async(cache.set)(compare_cache_key, compare_rating_history, timeout=86400)
                else:
                    leetcode_solved_compare = compare_stats.leetcode_solved if compare_stats.leetcode_solved is not None else 0
            else:
                await self.send(text_data=json.dumps({'error': f'No user found for comparison: {self.compare_to}'}))
                return

        data = {
            'codeforces_rating': user_stats.codeforces_rating if user_stats.codeforces_rating is not None else 'N/A',
            'codechef_rating': user_stats.codechef_rating if user_stats.codechef_rating is not None else 'N/A',
            'leetcode_solved': leetcode_solved,
            'rating_history': [h.to_dict() for h in rating_history] if rating_history else [],
            'compare_rating_history': [h.to_dict() for h in compare_rating_history] if compare_rating_history else [],
            'leetcode_solved_compare': leetcode_solved_compare,
            'has_no_ratings': has_no_ratings
        }

        print(f"Sending data: {data}")
        await self.send(text_data=json.dumps(data))

    async def update_stats(self, event):
        await self.send_initial_data()

class LeaderboardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        pass

    async def send_leaderboard(self, data):
        await self.send(text_data=json.dumps({'leaderboard_data': data}))
