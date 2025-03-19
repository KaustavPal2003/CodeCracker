import json
from channels.generic.websocket import AsyncWebsocketConsumer
from tracker.utils.fetch_stats import fetch_and_store_rating_history
from tracker.models import UserStats
from django.core.cache import cache
from asgiref.sync import sync_to_async

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
        compare_to = data.get('compare_to')
        self.compare_to = compare_to if compare_to else None
        await self.send_initial_data()

    async def send_initial_data(self):
        user_stats = await sync_to_async(UserStats.objects(username=self.username).first)()
        if not user_stats:
            await self.send(text_data=json.dumps({'error': 'User stats not found.'}))
            return

        cache_key = f'rating_history_{self.username}'
        rating_history = await sync_to_async(cache.get)(cache_key)

        if not rating_history:
            rating_history, leetcode_solved = await sync_to_async(fetch_and_store_rating_history)(self.username)
            await sync_to_async(cache.set)(cache_key, rating_history, timeout=None)
        else:
            leetcode_solved = user_stats.leetcode_solved

        compare_rating_history = []
        leetcode_solved_compare = 0
        if hasattr(self, 'compare_to') and self.compare_to:
            compare_stats = await sync_to_async(UserStats.objects(username=self.compare_to).first)()
            if compare_stats:
                compare_cache_key = f'rating_history_{self.compare_to}'
                compare_rating_history = await sync_to_async(cache.get)(compare_cache_key)
                if not compare_rating_history:
                    compare_rating_history, leetcode_solved_compare = await sync_to_async(fetch_and_store_rating_history)(self.compare_to)
                    await sync_to_async(cache.set)(compare_cache_key, compare_rating_history, timeout=None)
                else:
                    leetcode_solved_compare = compare_stats.leetcode_solved

        data = {
            'codeforces_rating': user_stats.codeforces_rating if user_stats.codeforces_rating is not None else 'N/A',
            'codechef_rating': user_stats.codechef_rating if user_stats.codechef_rating is not None else 'N/A',
            'leetcode_solved': leetcode_solved,
            'rating_history': [h.to_dict() for h in rating_history],
            'compare_rating_history': [h.to_dict() for h in compare_rating_history] if compare_rating_history else [],
            'leetcode_solved_compare': leetcode_solved_compare
        }

        await self.send(text_data=json.dumps(data))
        print(f"Sending data: {data}")
    async def update_stats(self, event):
        await self.send_initial_data()


import json
from channels.generic.websocket import WebsocketConsumer

class LeaderboardConsumer(WebsocketConsumer):
    def connect(self):
        self.accept()

    def disconnect(self, close_code):
        pass

    def receive(self, text_data):
        # Handle incoming messages if needed
        pass

    def send_leaderboard(self, data):
        self.send(text_data=json.dumps({'leaderboard_data': data}))