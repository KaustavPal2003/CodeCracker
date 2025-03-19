import asyncio
from tracker.utils.codeforces import fetch_codeforces_rating_history
from tracker.utils.selenium_scraper import fetch_codechef_contest_history_selenium

async def fetch_all_async(username):
    print(f"Fetching all contest history for {username}")
    try:
        codeforces_task = asyncio.to_thread(fetch_codeforces_rating_history, username)
        codechef_task = asyncio.to_thread(fetch_codechef_contest_history_selenium, username)
        codeforces_data, codechef_data = await asyncio.gather(codeforces_task, codechef_task)
        print(f"Raw Codeforces data: {codeforces_data}")
        print(f"Raw CodeChef data: {codechef_data}")
        result = {
            "codeforces": codeforces_data if isinstance(codeforces_data, list) else [],
            "codechef": codechef_data if isinstance(codechef_data, list) else []
        }
        print(f"Processed contest data: {result}")
        return result
    except Exception as e:
        print(f"Error in fetch_all_async: {str(e)}")
        return {"codeforces": [], "codechef": []}