import json
import zlib
import logging
from datetime import datetime
from django.core.cache import cache
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
import aiohttp
from django_ratelimit.core import is_ratelimited
from functools import wraps
from tracker.utils.async_fetchers import fetch_leetcode
from tracker.utils.sync_fetchers import fetch_and_store_rating_history
from tracker.models import UserStats

# Configure logging with detailed output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Rate limiting configuration
RATE_LIMIT = '60/m'  # 60 requests per minute

def get_username_from_scope(group, scope):
    """Custom key function to extract username from WebSocket scope"""
    return scope['url_route']['kwargs'].get('username', 'anonymous')

def async_ratelimit(key=get_username_from_scope, rate=RATE_LIMIT, group='websocket'):
    """Custom async ratelimit decorator for WebSocket consumers"""
    def decorator(func):
        @wraps(func)
        async def wrapper(self, *args, **kwargs):
            scope = self.scope

            # Check rate limit synchronously using is_ratelimited
            is_limited = await sync_to_async(is_ratelimited)(
                request=scope,
                group=group,
                key=key,
                rate=rate,
                increment=True
            )

            if is_limited:
                logger.warning(f"Rate limit exceeded for {self.username}")
                await self._send_compressed({
                    'error': 'Rate limit exceeded',
                    'timestamp': datetime.now().isoformat()
                })
                return

            return await func(self, *args, **kwargs)
        return wrapper
    return decorator

class StatsConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.username = self.scope['url_route']['kwargs']['username']
        self.compare_to = None
        await self.channel_layer.group_add(f"stats_{self.username}", self.channel_name)
        await self.accept()
        logger.info(f"WebSocket connected for user: {self.username}")
        await self.send_initial_data()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(f"stats_{self.username}", self.channel_name)
        logger.info(f"WebSocket disconnected for user: {self.username} with code {close_code}")

    @async_ratelimit(key=get_username_from_scope, rate=RATE_LIMIT)
    async def receive(self, text_data=None, bytes_data=None):
        try:
            if not bytes_data:
                raise ValueError("No data received")
            decompressed_data = zlib.decompress(bytes_data).decode()
            data = json.loads(decompressed_data)

            if not isinstance(data, dict):
                raise ValueError("Invalid data format: dictionary expected")

            self.compare_to = data.get('compare_to')
            force_refresh = data.get('force_refresh', False)

            if not self.compare_to or not isinstance(self.compare_to, str) or not self.compare_to.isalnum():
                raise ValueError("Invalid or missing compare_to username")

            logger.info(f"Received message for {self.username} with compare_to: {self.compare_to}, force_refresh: {force_refresh}")
            await self.send_initial_data(force_refresh=force_refresh)
        except zlib.error as e:
            logger.error(f"Zlib decompression error for {self.username}: {e}", exc_info=True)
            await self._send_compressed({
                'error': f"Invalid compression format: {str(e)}",
                'timestamp': datetime.now().isoformat()
            })
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error for {self.username}: {e}", exc_info=True)
            await self._send_compressed({
                'error': f"Invalid JSON format: {str(e)}",
                'timestamp': datetime.now().isoformat()
            })
        except ValueError as ve:
            logger.error(f"Validation error for {self.username}: {ve}", exc_info=True)
            await self._send_compressed({
                'error': str(ve),
                'timestamp': datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"Unexpected error in receive for {self.username}: {e}", exc_info=True)
            await self._send_compressed({
                'error': f"Internal server error in receive: {str(e)}",
                'timestamp': datetime.now().isoformat()
            })

    def _safe_int(self, value, default=0):
        """Convert value to int safely"""
        try:
            return int(value or default)
        except (TypeError, ValueError):
            return default

    def _serialize_history(self, rating_history):
        """Serialize rating_history for JSON"""
        if not rating_history:
            return []
        return [{
            'platform': str(entry.get('platform', '')),
            'contest': str(entry.get('contest', '')),
            'rank': self._safe_int(entry.get('rank')),
            'old_rating': self._safe_int(entry.get('old_rating')),
            'new_rating': self._safe_int(entry.get('new_rating')),
            'date': entry.get('date', datetime.now()).isoformat() if isinstance(entry.get('date'), datetime) else str(entry.get('date', datetime.now())),
            'change': self._safe_int(entry.get('new_rating')) - self._safe_int(entry.get('old_rating'))
        } for entry in rating_history if entry]

    async def send_initial_data(self, force_refresh=False):
        try:
            user_stats = await sync_to_async(UserStats.objects.filter(username=self.username).first)()
            if not user_stats:
                logger.warning(f"No stats found for {self.username}")
                await self._send_compressed({
                    'error': f'User stats not found for {self.username}',
                    'timestamp': datetime.now().isoformat()
                })
                return

            cache_key = f'rating_history_{self.username}'
            cached_data = None if force_refresh else await sync_to_async(cache.get)(cache_key)

            async with aiohttp.ClientSession() as session:
                user1_data = await self._fetch_user_data(self.username, user_stats, cached_data, cache_key, session)
                user1_data['status'] = 'fresh' if force_refresh or not cached_data else 'cached'

                response = {
                    'user1': user1_data,
                    'timestamp': datetime.now().isoformat()
                }

                if self.compare_to:
                    logger.info(f"Fetching data for compare_to: {self.compare_to}")
                    try:
                        compare_stats = await sync_to_async(UserStats.objects.filter(username=self.compare_to).first)()
                        if compare_stats and self.compare_to != self.username:
                            compare_cache_key = f'rating_history_{self.compare_to}'
                            compare_cached_data = None if force_refresh else await sync_to_async(cache.get)(compare_cache_key)
                            compare_data = await self._fetch_user_data(self.compare_to, compare_stats, compare_cached_data, compare_cache_key, session)
                            compare_data['status'] = 'fresh' if force_refresh or not compare_cached_data else 'cached'
                            response['compare_to'] = compare_data
                        else:
                            logger.warning(f"No stats found or same as primary user for compare_to: {self.compare_to}")
                            response['compare_to'] = {
                                'username': self.compare_to,
                                'error': 'User stats not found or same as primary user',
                                'status': 'unavailable'
                            }
                    except Exception as e:
                        logger.error(f"Error fetching compare_to data for {self.compare_to}: {e}", exc_info=True)
                        response['compare_to'] = {
                            'username': self.compare_to,
                            'error': f"Failed to fetch data: {str(e)}",
                            'status': 'error'
                        }

                logger.info(f"Sending data for {self.username} with response: {json.dumps(response, default=str)}")
                await self._send_compressed(response)
        except Exception as e:
            logger.error(f"Error in send_initial_data for {self.username}: {e}", exc_info=True)
            await self._send_compressed({
                'error': f"Internal server error in send_initial_data: {str(e)}",
                'timestamp': datetime.now().isoformat()
            })

    async def _fetch_user_data(self, username, stats, cached_data, cache_key, session):
        """Fetch and cache user data"""
        if cached_data and isinstance(cached_data, dict):
            logger.debug(f"Using cached data for {username}")
            return self._process_cached_data(cached_data, username, stats)

        logger.info(f"Fetching fresh data for {username}")
        try:
            history, lc_solved = await sync_to_async(fetch_and_store_rating_history)(username)
            rating_history = [h.to_mongo().to_dict() for h in history] if history else []

            leetcode_history = [h for h in rating_history if h.get('platform') == 'LeetCode']
            leetcode_rating = max([self._safe_int(h['new_rating']) for h in leetcode_history], default=0) if leetcode_history else 0

            user_data = {
                'username': username,
                'codeforces_rating': self._safe_int(stats.codeforces_rating),
                'leetcode_solved': self._safe_int(lc_solved),
                'leetcode_rating': leetcode_rating,
                'leetcode_contests': len(leetcode_history),
                'codechef_rating': self._safe_int(stats.codechef_rating),
                'rating_history': self._serialize_history(rating_history),
                'last_updated': datetime.now().isoformat()
            }

            has_no_ratings = not any([
                user_data['codeforces_rating'],
                user_data['codechef_rating'],
                user_data['leetcode_solved'],
                user_data['rating_history']
            ])
            user_data['has_no_ratings'] = has_no_ratings

            await sync_to_async(cache.set)(cache_key, user_data, timeout=86400)
            return user_data
        except Exception as e:
            logger.error(f"Error fetching fresh data for {username}: {e}", exc_info=True)
            raise

    def _process_cached_data(self, cached_data, username, stats):
        """Process cached data with validation"""
        user_data = cached_data.copy()
        user_data['username'] = username
        user_data['codeforces_rating'] = self._safe_int(stats.codeforces_rating)
        user_data['leetcode_solved'] = self._safe_int(user_data.get('leetcode_solved'))
        user_data['leetcode_rating'] = self._safe_int(user_data.get('leetcode_rating'))
        user_data['codechef_rating'] = self._safe_int(stats.codechef_rating)
        user_data['rating_history'] = self._serialize_history(user_data.get('rating_history', []))
        user_data['leetcode_contests'] = len([h for h in user_data['rating_history'] if h.get('platform') == 'LeetCode'])
        return user_data

    async def _send_compressed(self, data):
        """Send compressed data over WebSocket"""
        try:
            json_data = json.dumps(data)
            compressed_data = zlib.compress(json_data.encode())
            await self.send(bytes_data=compressed_data)
        except Exception as e:
            logger.error(f"Error sending compressed data for {self.username}: {e}", exc_info=True)
            raise

class LeaderboardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        logger.info("Leaderboard WebSocket connected")

    async def disconnect(self, close_code):
        logger.info(f"Leaderboard WebSocket disconnected with code {close_code}")

    async def receive(self, text_data=None, bytes_data=None):
        try:
            if not bytes_data:
                raise ValueError("No data received")
            decompressed_data = zlib.decompress(bytes_data).decode()
            data = json.loads(decompressed_data)
            logger.debug(f"Leaderboard received: {data}")
            # Add leaderboard-specific logic here if needed
        except Exception as e:
            logger.error(f"Error in LeaderboardConsumer receive: {e}", exc_info=True)
            await self._send_compressed({
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })

    async def send_leaderboard(self, data):
        """Send leaderboard data with compression"""
        await self._send_compressed({
            'leaderboard_data': data,
            'timestamp': datetime.now().isoformat()
        })

    async def _send_compressed(self, data):
        """Send compressed data over WebSocket"""
        try:
            json_data = json.dumps(data)
            compressed_data = zlib.compress(json_data.encode())
            await self.send(bytes_data=compressed_data)
        except Exception as e:
            logger.error(f"Error sending compressed leaderboard data: {e}", exc_info=True)