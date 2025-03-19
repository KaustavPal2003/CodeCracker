# tracker/utils/selenium_scraper.py
from django.core.cache import cache
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os
import json
import re
import time

def fetch_codechef_contest_history_selenium(username):
    """Fetch contest history from CodeChef using Selenium with caching."""
    cache_key = f"codechef_contests_{username}"
    cached_data = cache.get(cache_key)
    if cached_data is not None:
        print(f"Retrieved cached data for {username}: {cached_data}")
        return cached_data
    
    url = f"https://www.codechef.com/users/{username}"
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920x1080")
    chromedriver_path = "E:/Best_project/codecracker/chromedriver.exe"
    if not os.path.exists(chromedriver_path):
        print(f"⚠️ ChromeDriver not found at {chromedriver_path}")
        return []
    
    driver = None
    try:
        service = Service(chromedriver_path)
        driver = webdriver.Chrome(service=service, options=chrome_options)
        print(f"Fetching CodeChef profile: {url}")
        driver.get(url)
        
        # Wait for the user details container to load
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CLASS_NAME, "user-details-container"))
        )
        time.sleep(2)  # Additional wait for dynamic content
        
        # Find contest data in script tags
        contest_data = None
        script_tags = driver.find_elements(By.TAG_NAME, "script")
        for script in script_tags:
            script_text = script.get_attribute("innerHTML")
            if script_text and "date_versus_rating" in script_text:
                match = re.search(r'date_versus_rating"\s*:\s*({(?:[^{}]+|\{(?:[^{}]+|\{[^{}]*\})*\})*})', script_text, re.DOTALL)
                if match:
                    contest_data = json.loads(match.group(1))
                    break
        
        if not contest_data:
            print("No contest data found in script tags")
            return []
        
        contests = []
        for category, entries in contest_data.items():
            for entry in entries:
                contests.append({
                    "contest": entry.get("name", "Unknown Contest"),
                    "rank": int(entry.get("rank", 0)) if entry.get("rank") else 0,
                    "new_rating": int(entry.get("rating", 0)) if entry.get("rating") else 0,
                    "old_rating": int(entry.get("oldRating", 0)) if entry.get("oldRating") else 0,
                    "change": int(entry.get("change", 0)) if entry.get("change") else 0,
                    "date": entry.get("end_date", "Unknown")
                })
        
        print(f"Scraped {len(contests)} contests for {username}: {contests}")
        cache.set(cache_key, contests, timeout=3600)  # Cache for 1 hour
        return contests
    except Exception as e:
        print(f"⚠️ Selenium scraping failed for {username}: {str(e)}")
        return []
    finally:
        if driver:
            driver.quit()