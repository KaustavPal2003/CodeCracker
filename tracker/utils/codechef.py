import requests
from bs4 import BeautifulSoup
from django.core.cache import cache
from tracker.utils.selenium_scraper import fetch_codechef_contest_history_selenium


def fetch_codechef_rating(username):
    """Fetch CodeChef rating using web scraping with caching."""
    cache_key = f"codechef_rating_{username}"

    # Check if the rating is already cached
    cached_rating = cache.get(cache_key)
    if cached_rating is not None:
        return cached_rating

    url = f"https://www.codechef.com/users/{username}"
    try:
        # Send a GET request to the CodeChef profile page
        response = requests.get(url, timeout=10)

        # Check for a successful response
        if response.status_code != 200:
            print(f"⚠️ Failed to fetch CodeChef profile: HTTP {response.status_code}")
            return 0

        # Parse the response content
        soup = BeautifulSoup(response.text, "html.parser")
        rating_tag = soup.find("div", class_="rating-number")

        # Extract the rating, defaulting to 0 if not found
        rating = int(rating_tag.text.strip()) if rating_tag else 0

        # Cache the rating for future requests
        cache.set(cache_key, rating, timeout=3600)
        return rating
    except requests.RequestException as e:
        print(f"⚠️ CodeChef Scraping Error: {e}")
        return 0
    except Exception as e:
        print(f"⚠️ Unexpected Error: {e}")
        return 0


def fetch_codechef_contest_history(username):
    """Fetch contest history from CodeChef using Selenium."""
    return fetch_codechef_contest_history_selenium(username)