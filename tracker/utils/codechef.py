import requests
from bs4 import BeautifulSoup
from django.core.cache import cache
from tracker.utils.selenium_scraper import fetch_codechef_contest_history_selenium

def fetch_codechef_rating(username):
    """Fetch CodeChef rating using web scraping with caching."""
    cache_key = f"codechef_rating_{username}"
    cached_rating = cache.get(cache_key)
    if cached_rating is not None:
        return cached_rating
    
    url = f"https://www.codechef.com/users/{username}"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            print(f"⚠️ Failed to fetch CodeChef profile: HTTP {response.status_code}")
            return 0
        soup = BeautifulSoup(response.text, "html.parser")
        rating_tag = soup.find("div", class_="rating-number")
        rating = int(rating_tag.text.strip()) if rating_tag else 0
        cache.set(cache_key, rating, timeout=3600)
        return rating
    except Exception as e:
        print(f"⚠️ CodeChef Scraping Error: {e}")
        return 0

def fetch_codechef_contest_history(username):
    """Fetch contest history from CodeChef using Selenium."""
    return fetch_codechef_contest_history_selenium(username)