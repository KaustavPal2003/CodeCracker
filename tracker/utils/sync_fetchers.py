import requests
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from tracker.models import UserStats, RatingHistory


def fetch_and_store_rating_history(username):
    """Synchronous fallback for rating history fetching."""
    print(f"Starting rating history fetch for {username}")
    history = []

    # Codeforces
    try:
        cf_url = f"https://codeforces.com/api/user.rating?handle={username}"
        cf_response = requests.get(cf_url, timeout=10)
        cf_response.raise_for_status()
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

    # CodeChef
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
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CLASS_NAME, "rating-number"))
        )
        rating_elem = driver.find_element(By.CLASS_NAME, "rating-number")
        current_rating = int(rating_elem.text.strip())
        history.append(RatingHistory(
            platform="CodeChef",
            contest="Latest Rating",
            rank=0,
            old_rating=0,
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
                query getUserProfile($username: Water!) {
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

    # Store in MongoDB
    try:
        user = UserStats.objects(username=username).first()
        if not user:
            user = UserStats(username=username)
        user.rating_history = history
        user.leetcode_solved = lc_solved
        user.codeforces_rating = max((h.new_rating for h in history if h.platform == "Codeforces"), default=0)
        user.codechef_rating = max((h.new_rating for h in history if h.platform == "CodeChef"), default=0)
        user.save()
        print(f"Stored rating history for {username}: {len(history)} entries, LeetCode solved: {lc_solved}")
    except Exception as e:
        print(f"Error storing rating history: {str(e)}")

    return history, lc_solved


def fetch_and_store_user_stats(username):
    """Fetch and store user stats from Codeforces, LeetCode, and CodeChef."""
    from django.core.cache import cache
    cache_key = f"user_stats_{username}"
    cached_user = cache.get(cache_key)
    if cached_user:
        print(f"Retrieved cached stats for {username}: {cached_user.codeforces_rating}, {cached_user.leetcode_solved}, {cached_user.codechef_rating}")
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

    # LeetCode
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