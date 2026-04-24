# tracker/utils/contest_tracker.py
"""
Updated: uses codechef_api and atcoder instead of selenium_scraper.
"""
import asyncio
from tracker.utils.codeforces import fetch_codeforces_rating_history
from tracker.utils.codechef_api import fetch_codechef_contest_history
from tracker.utils.atcoder import fetch_atcoder_history


async def fetch_all_async(username):
    codeforces_task = asyncio.to_thread(fetch_codeforces_rating_history, username)
    codechef_task   = asyncio.to_thread(fetch_codechef_contest_history,  username)
    atcoder_task    = asyncio.to_thread(lambda: fetch_atcoder_history(username)[0], )

    cf_data, cc_data, ac_data = await asyncio.gather(
        codeforces_task, codechef_task, atcoder_task
    )

    return {
        "codeforces": cf_data if isinstance(cf_data, list) else [],
        "codechef":   cc_data if isinstance(cc_data, list) else [],
        "atcoder":    ac_data if isinstance(ac_data, list) else [],
    }
