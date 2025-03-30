# tracker/utils/__init__.py
from .codeforces import (
    fetch_codeforces_stats,
    fetch_codeforces_rating_history,
    fetch_codeforces_rating_history_async  # Add async version for flexibility
)
from .leetcode import (
    fetch_leetcode_stats,
)
from .codechef import (
    fetch_codechef_rating,
    fetch_codechef_contest_history
)
from .selenium_scraper import (
    fetch_codechef_contest_history_selenium  # Explicitly include if needed separately
)
from .tasks import (
    fetch_and_store_user_stats_task,
    fetch_and_store_rating_history_task  # Add if exists in tasks.py
)
from .async_fetchers import (
    fetch_and_store_rating_history_async  # Async rating history fetcher
)
from .sync_fetchers import (
    fetch_and_store_rating_history,       # Sync rating history fetcher
    fetch_and_store_user_stats            # Sync user stats fetcher
)
from .fetch_coordinator import (
    fetch_and_store_all                   # Main async coordinator for all data
)
from .contest_tracker import (
    fetch_all_async  # Include the multi-platform async fetcher
)

# Removed: contest_operations.py (no longer exists)