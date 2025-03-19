# tracker/utils/fetch_stats.py
import asyncio
import requests
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from datetime import datetime
import time
from django.core.cache import cache
from tracker.models import UserStats, RatingHistory
from tracker.utils.contest_tracker import fetch_all_async

from mongoengine import connect
import aiohttp
from tracker.models import RatingHistory
from bs4 import BeautifulSoup

import asyncio
import aiohttp
from bs4 import BeautifulSoup
from datetime import datetime
from tracker.models import RatingHistory

import asyncio
import aiohttp
from bs4 import BeautifulSoup
from datetime import datetime
from tracker.models import RatingHistory

# tracker/utils.py
import asyncio
import aiohttp
from bs4 import BeautifulSoup
from datetime import datetime
from tracker.models import RatingHistory

async def fetch_and_store_rating_history_async(username):
    print(f"Fetching rating history async for {username}")
    
    async def fetch_codeforces(session):
        print(f"Fetching Codeforces history for {username}")
        url = f"https://codeforces.com/api/user.rating?handle={username}"
        async with session.get(url) as response:
            if response.status != 200:
                print(f"Codeforces API error: {response.status} - {await response.text()}")
                return []
            data = await response.json()
            if data["status"] != "OK":
                print(f"Codeforces API failed: {data.get('comment', 'Unknown error')}")
                return []
            return data["result"]

    async def fetch_codechef(session):
        print(f"Fetching CodeChef history for {username}")
        url = f"https://www.codechef.com/users/{username}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        async with session.get(url, headers=headers) as response:
            if response.status != 200:
                print(f"CodeChef fetch error: {response.status}")
                return []
            html = await response.text()
            soup = BeautifulSoup(html, "html.parser")
            rating_elem = soup.select_one(".rating-number")
            if not rating_elem:
                print(f"No CodeChef rating found for {username} - Page may not exist or structure changed")
                return []
            try:
                current_rating = int(rating_elem.text.strip())
                print(f"Found CodeChef rating for {username}: {current_rating}")
                return [{
                    "contest": "Latest Rating",
                    "rank": 0,
                    "new_rating": current_rating,
                    "old_rating": 0,
                    "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }]
            except ValueError:
                print(f"Invalid CodeChef rating format for {username}: {rating_elem.text}")
                return []

    async def fetch_leetcode(session):
        print(f"Fetching LeetCode stats for {username}")
        url = "https://leetcode.com/graphql/"
        query = {
            "query": """
                query getUserProfile($username: String!) {
                    matchedUser(username: $username) {
                        submitStats: submitStatsGlobal {
                            acSubmissionNum {
                                difficulty
                                count
                            }
                        }
                    }
                }
            """,
            "variables": {"username": username}
        }
        async with session.post(url, json=query) as response:
            if response.status != 200:
                print(f"LeetCode API error: {response.status} - {await response.text()}")
                return 0
            data = await response.json()
            if data.get("data", {}).get("matchedUser") is None:
                print(f"LeetCode user {username} not found")
                return 0
            try:
                stats = data["data"]["matchedUser"]["submitStats"]["acSubmissionNum"]
                total_solved = sum(item["count"] for item in stats)
                print(f"Found {total_solved} LeetCode solved for {username}")
                return total_solved
            except (KeyError, TypeError) as e:
                print(f"LeetCode data parsing error for {username}: {e}")
                return 0

    async with aiohttp.ClientSession() as session:
        cf_task = asyncio.create_task(fetch_codeforces(session))
        cc_task = asyncio.create_task(fetch_codechef(session))
        lc_task = asyncio.create_task(fetch_leetcode(session))
        cf_data, cc_data, lc_solved = await asyncio.gather(cf_task, cc_task, lc_task)
    
    history = []
    for entry in cf_data:
        date_obj = datetime.fromtimestamp(entry["ratingUpdateTimeSeconds"])
        history.append(RatingHistory(
            platform="Codeforces",
            contest=entry["contestName"],
            rank=entry["rank"],
            old_rating=entry["oldRating"],
            new_rating=entry["newRating"],
            date=date_obj
        ))
    
    for entry in cc_data:
        date_obj = datetime.strptime(entry["date"], "%Y-%m-%d %H:%M:%S")
        history.append(RatingHistory(
            platform="Codechef",
            contest=entry["contest"],
            rank=entry["rank"],
            old_rating=entry["old_rating"],
            new_rating=entry["new_rating"],
            date=date_obj
        ))
    
    print(f"Retrieved {len(history)} contests and {lc_solved} LeetCode solved for {username}")
    return history, lc_solved

import requests
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from asgiref.sync import sync_to_async
from tracker.models import UserStats, RatingHistory

def fetch_and_store_rating_history(username):
    """Synchronous fallback for rating history fetching."""
    print(f"Starting rating history fetch for {username}")
    history = []

    # Codeforces
    try:
        cf_url = f"https://codeforces.com/api/user.rating?handle={username}"
        cf_response = requests.get(cf_url, timeout=10)
        cf_response.raise_for_status()  # Raise exception for bad status codes
        cf_data = cf_response.json()
        if cf_data["status"] == "OK":
            for contest in cf_data["result"]:
                history.append(RatingHistory(
                    platform="Codeforces",
                    contest=contest["contestName"],
                    rank=contest["rank"],
                    old_rating=contest["oldRating"],
                    new_rating=contest["newRating"],
                    date=datetime.fromtimestamp(contest["ratingUpdateTimeSeconds"])
                ))
            print(f"Codeforces fetched {len(cf_data['result'])} contests")
        else:
            print(f"Codeforces API failed: {cf_data.get('comment', 'Unknown error')}")
    except Exception as e:
        print(f"Error fetching Codeforces history: {str(e)}")

    # CodeChef (Scraping current rating only, as full history isn’t public)
    chromedriver_path = "E:/Best_project/codecracker/chromedriver.exe"
    driver = None
    try:
        cc_url = f"https://www.codechef.com/users/{username}"
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        service = Service(chromedriver_path)
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.get(cc_url)
        
        # Wait for rating element (not full history table)
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CLASS_NAME, "rating-number"))
        )
        rating_elem = driver.find_element(By.CLASS_NAME, "rating-number")
        current_rating = int(rating_elem.text.strip())
        
        history.append(RatingHistory(
            platform="CodeChef",
            contest="Latest Rating",
            rank=0,  # Rank not available
            old_rating=0,  # Full history not available
            new_rating=current_rating,
            date=datetime.now()
        ))
        print(f"CodeChef fetched current rating: {current_rating}")
    except Exception as e:
        print(f"Error fetching CodeChef history: {str(e)}")
    finally:
        if driver:
            driver.quit()

    # LeetCode
    lc_solved = 0
    try:
        lc_url = "https://leetcode.com/graphql/"
        query = {
            "query": """
                query getUserProfile($username: String!) {
                    matchedUser(username: $username) {
                        submitStats: submitStatsGlobal {
                            acSubmissionNum {
                                difficulty
                                count
                            }
                        }
                    }
                }
            """,
            "variables": {"username": username}
        }
        lc_response = requests.post(lc_url, json=query, timeout=10)
        lc_response.raise_for_status()
        lc_data = lc_response.json()
        if lc_data.get("data", {}).get("matchedUser") is None:
            print(f"LeetCode user {username} not found")
        else:
            stats = lc_data["data"]["matchedUser"]["submitStats"]["acSubmissionNum"]
            lc_solved = sum(item["count"] for item in stats)
            print(f"LeetCode fetched {lc_solved} solved problems")
    except Exception as e:
        print(f"Error fetching LeetCode stats: {str(e)}")

    # Store in MongoDB (sync call wrapped for async compatibility)
    try:
        user = UserStats.objects(username=username).first()  # Sync call, but we'll wrap in fetch_and_store_all
        if not user:
            user = UserStats(username=username)
        user.rating_history = history
        user.leetcode_solved = lc_solved
        user.codeforces_rating = max((h.new_rating for h in history if h.platform == "Codeforces"), default=0)
        user.codechef_rating = max((h.new_rating for h in history if h.platform == "CodeChef"), default=0)
        user.save()  # Sync call
        print(f"Stored rating history for {username}: {len(history)} entries, LeetCode solved: {lc_solved}")
    except Exception as e:
        print(f"Error storing rating history: {str(e)}")

    return history, lc_solved  # Match async function return type

def fetch_and_store_user_stats(username):
    """Fetch and store user stats from Codeforces, LeetCode, and CodeChef."""
    cache_key = f"user_stats_{username}"
    cached_user = cache.get(cache_key)
    if cached_user:
        print(f"Retrieved cached stats for {username}: {cached_user.codeforces_rating}, {cached_user.leetcode_solved}, {cached_user.codechef_rating}")
        # Ensure cached stats are persisted to MongoDB
        UserStats.objects(username=username).update_one(
            set__codeforces_rating=cached_user.codeforces_rating,
            set__leetcode_solved=cached_user.leetcode_solved,
            set__codechef_rating=cached_user.codechef_rating,
            upsert=True
        )
        return UserStats.objects(username=username).first()

    print(f"Fetching user stats for {username}")
    user_data = {"codeforces_rating": 0, "leetcode_solved": 0, "codechef_rating": 0}

    # Codeforces
    try:
        cf_url = f"https://codeforces.com/api/user.info?handles={username}"
        cf_response = requests.get(cf_url)
        cf_data = cf_response.json()
        if cf_data["status"] == "OK" and cf_data["result"]:
            user_data["codeforces_rating"] = cf_data["result"][0].get("rating", 0)
            print(f"Codeforces rating fetched: {user_data['codeforces_rating']}")
    except Exception as e:
        print(f"Codeforces fetch failed: {str(e)}")

    # LeetCode (temporary skip due to scraping issues)
    user_data["leetcode_solved"] = 0
    print("LeetCode scraping skipped due to dynamic content issues")

    # CodeChef
    chromedriver_path = "E:/Best_project/codecracker/chromedriver.exe"
    driver = None
    try:
        cc_url = f"https://www.codechef.com/users/{username}"
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        service = Service(chromedriver_path)
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.get(cc_url)
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, "rating-number"))
        )
        time.sleep(2)
        rating_element = driver.find_element(By.CLASS_NAME, "rating-number")
        user_data["codechef_rating"] = int(rating_element.text.split()[0])
        print(f"CodeChef rating fetched: {user_data['codechef_rating']}")
    except Exception as e:
        print(f"Error fetching CodeChef stats: {str(e)}")
    finally:
        if driver:
            driver.quit()

    # Store in MongoDB and cache
    try:
        UserStats.objects(username=username).update_one(
            set__codeforces_rating=user_data["codeforces_rating"],
            set__leetcode_solved=user_data["leetcode_solved"],
            set__codechef_rating=user_data["codechef_rating"],
            upsert=True
        )
        user = UserStats.objects(username=username).first()
        cache.set(cache_key, user, timeout=3600)
        print(f"Stored user stats: CF={user_data['codeforces_rating']}, LC={user_data['leetcode_solved']}, CC={user_data['codechef_rating']}")
        return user
    except Exception as e:
        print(f"Error storing user stats: {str(e)}")
        return None

async def fetch_and_store_all(username):
    """Fetch and store all user data (stats and history) asynchronously."""
    print(f"Fetching all data for {username}")
    
    user = await sync_to_async(UserStats.objects(username=username).first)()
    if not user:
        user = UserStats(username=username)
        await sync_to_async(user.save)()
    
    try:
        history, lc_solved = await fetch_and_store_rating_history_async(username)
        user.rating_history = history
        user.leetcode_solved = lc_solved
        user.codeforces_rating = max((h.new_rating for h in history if h.platform == "Codeforces"), default=0)
        user.codechef_rating = max((h.new_rating for h in history if h.platform == "CodeChef"), default=0)
        await sync_to_async(user.save)()
        print(f"Stored async rating history for {username}: {len(history)} entries, LeetCode solved: {lc_solved}")
    except Exception as e:
        print(f"Error in async fetch for {username}: {str(e)}")
        # Fallback to sync
        history, lc_solved = await sync_to_async(fetch_and_store_rating_history)(username)
        user.rating_history = history
        user.leetcode_solved = lc_solved
        user.codeforces_rating = max((h.new_rating for h in history if h.platform == "Codeforces"), default=0)
        user.codechef_rating = max((h.new_rating for h in history if h.platform == "CodeChef"), default=0)
        await sync_to_async(user.save)()
        print(f"Stored sync fallback rating history for {username}: {len(history)} entries, LeetCode solved: {lc_solved}")
    
    return user