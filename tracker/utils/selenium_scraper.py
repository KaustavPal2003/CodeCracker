from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import json
import re
from datetime import datetime


def fetch_codechef_contest_history_selenium(username):
    chromedriver_path = "E:/Best_project/codecracker/chromedriver.exe"
    url = f"https://www.codechef.com/users/{username}"
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    service = Service(chromedriver_path)
    service.start_timeout = 30
    driver = None

    try:
        driver = webdriver.Chrome(service=service, options=options)
        driver.set_page_load_timeout(120)  # Increase from 60
        for attempt in range(3):
            try:
                driver.get(url)
                WebDriverWait(driver, 30).until(  # Increase from 15
                    EC.presence_of_element_located((By.TAG_NAME, "body"))
                )
                print(f"Page loaded on attempt {attempt + 1}")
                break
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == 2:
                    raise
        WebDriverWait(driver, 10).until(
            lambda d: d.execute_script("return document.readyState") == "complete"
        )
        print("Page fully loaded")

        script_tags = driver.find_elements(By.TAG_NAME, "script")
        print(f"Found {len(script_tags)} script tags")
        for script in script_tags:
            text = script.get_attribute("innerHTML")
            if text and "date_versus_rating" in text:
                print("Found date_versus_rating script")
                print(f"Script content preview: {text[:200]}...")
                match = re.search(r'date_versus_rating"\s*:\s*({.*?})(?=\s*,\s*"[^"]+"|\s*})', text, re.DOTALL)
                if match:
                    raw_json = match.group(1)
                    print(f"Raw JSON extracted: {raw_json[:300]}...")
                    try:
                        data = json.loads(raw_json)
                        contests = []
                        old_ratings = {entry["code"]: int(entry.get("rating", 0)) for entry in data.get("all_old", [])}
                        for entry in data.get("all", []):
                            date_str = entry.get("end_date", datetime.now().strftime("%Y-%m-%d"))
                            try:
                                date = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                            except ValueError:
                                date = datetime.now()
                            contest_code = entry.get("code", "")
                            contests.append({
                                "contest": entry.get("name", "Unknown"),
                                "rank": int(entry.get("rank", 0)),
                                "old_rating": old_ratings.get(contest_code, 0),
                                "new_rating": int(entry.get("rating", 0)),
                                "date": date.strftime("%Y-%m-%d %H:%M:%S")
                            })
                        if contests:
                            print(f"CodeChef fetched {len(contests)} contests from script")
                            return contests
                        else:
                            print("No contest data in script")
                    except json.JSONDecodeError as e:
                        print(f"JSON parsing error: {e}")
                        print(f"Problematic JSON: {raw_json[:500]}...")

        print("No contest history found in script")
        try:
            rating_elem = driver.find_element(By.CLASS_NAME, "rating-number")
            current_rating = int(rating_elem.text.strip())
            return [{"contest": "Latest Rating", "rank": 0, "old_rating": 0, "new_rating": current_rating,
                     "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}]
        except:
            print("Falling back to zero rating")
            return []

    except Exception as e:
        print(f"CodeChef Selenium error: {e}")
        try:
            if driver:
                rating_elem = driver.find_element(By.CLASS_NAME, "rating-number")
                current_rating = int(rating_elem.text.strip())
                print(f"CodeChef fallback to current rating: {current_rating}")
                return [{
                    "contest": "Latest Rating",
                    "rank": 0,
                    "old_rating": 0,
                    "new_rating": current_rating,
                    "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }]
        except:
            print("Failed to fetch even current rating")
            return []
    finally:
        if driver:
            driver.quit()


if __name__ == "__main__":
    result = fetch_codechef_contest_history_selenium("tourist")
    print(result[:5])  # Print first 5 for brevity