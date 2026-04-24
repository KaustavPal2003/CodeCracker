"""
CodeCracker — Platform Fetcher Health Check
============================================
Run from your project root (no Django server needed):

    python test_fetchers.py

Or test a specific platform only:

    python test_fetchers.py codeforces
    python test_fetchers.py leetcode
    python test_fetchers.py codechef
    python test_fetchers.py atcoder

Edit the HANDLES dict below to use real usernames for each platform.
A platform handle left as None is skipped.
"""

import sys
import time
import asyncio
import aiohttp
import requests
from datetime import datetime

# ─── CONFIGURE YOUR TEST HANDLES HERE ────────────────────────────────────────
HANDLES = {
    "codeforces": "Benq",   # Your CF handle (or None to skip)
    "leetcode":   "KaustavPal2003",   # Your LC handle (or None to skip)
    "codechef":   "nachia",   # Your CC handle (or None to skip)
    "atcoder":    "tourist",               # Set an AtCoder handle to test it, or leave None
}
# ─────────────────────────────────────────────────────────────────────────────

PASS  = "✅ PASS"
FAIL  = "❌ FAIL"
SKIP  = "⏭  SKIP"
WARN  = "⚠️  WARN"

results = {}


def section(title):
    print(f"\n{'─'*55}")
    print(f"  {title}")
    print(f"{'─'*55}")


def report(platform, status, detail=""):
    tag = {"pass": PASS, "fail": FAIL, "skip": SKIP, "warn": WARN}[status]
    print(f"  {tag}  {detail}")
    results[platform] = status


# ══════════════════════════════════════════════════════════════════════════════
# CODEFORCES
# ══════════════════════════════════════════════════════════════════════════════
def test_codeforces(username):
    section(f"Codeforces  →  {username}")
    t = time.time()

    # 1. user.info (current rating)
    try:
        r = requests.get(
            f"https://codeforces.com/api/user.info?handles={username}",
            timeout=10
        )
        data = r.json()
        if data.get("status") == "OK":
            rating = data["result"][0].get("rating", "unrated")
            print(f"  user.info         → rating={rating}  ({r.status_code}, {time.time()-t:.2f}s)")
        else:
            print(f"  user.info         → API error: {data.get('comment')}  ({r.status_code})")
    except Exception as e:
        print(f"  user.info         → Exception: {e}")

    # 2. user.rating (contest history)
    try:
        t2 = time.time()
        r = requests.get(
            f"https://codeforces.com/api/user.rating?handle={username}",
            timeout=10
        )
        data = r.json()
        if data.get("status") == "OK":
            entries = data["result"]
            latest  = entries[-1] if entries else None
            if latest:
                dt = datetime.fromtimestamp(latest["ratingUpdateTimeSeconds"]).strftime("%Y-%m-%d")
                print(f"  user.rating       → {len(entries)} contests, latest={latest['contestName'][:35]} on {dt}  ({time.time()-t2:.2f}s)")
                report("codeforces", "pass", f"{len(entries)} contest entries fetched")
            else:
                print(f"  user.rating       → 0 contests (account may be unrated)")
                report("codeforces", "warn", "0 contest entries — account may be unrated")
        else:
            print(f"  user.rating       → API error: {data.get('comment')}  ({r.status_code})")
            report("codeforces", "fail", data.get("comment", "unknown error"))
    except Exception as e:
        print(f"  user.rating       → Exception: {e}")
        report("codeforces", "fail", str(e))


# ══════════════════════════════════════════════════════════════════════════════
# LEETCODE
# ══════════════════════════════════════════════════════════════════════════════
async def _lc_post(session, url, payload, label):
    headers = {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com/",
        "User-Agent": "Mozilla/5.0",
    }
    t = time.time()
    try:
        async with session.post(url, json=payload, headers=headers,
                                timeout=aiohttp.ClientTimeout(total=12)) as resp:
            elapsed = time.time() - t
            if resp.status != 200:
                print(f"  {label:<25} → HTTP {resp.status}  ({elapsed:.2f}s)")
                return None, elapsed
            data = await resp.json()
            return data, elapsed
    except Exception as e:
        print(f"  {label:<25} → Exception: {e}")
        return None, time.time() - t


async def test_leetcode_async(username):
    section(f"LeetCode  →  {username}")

    url = "https://leetcode.com/graphql/"

    async with aiohttp.ClientSession() as session:

        # 1. Solved count (the query we fixed)
        q_solved = {
            "query": """query getUserProfile($username: String!) {
                matchedUser(username: $username) {
                    submitStats: submitStatsGlobal { acSubmissionNum { difficulty count } }
                }
            }""",
            "variables": {"username": username}
        }
        data, elapsed = await _lc_post(session, url, q_solved, "solved count query")
        if data:
            mu = data.get("data", {}).get("matchedUser")
            if not mu:
                print(f"  solved count query        → user not found  ({elapsed:.2f}s)")
                report("leetcode", "fail", "matchedUser is null — username may be wrong")
                return
            nums = mu["submitStats"]["acSubmissionNum"]
            # Check all difficulties are present
            difficulties = {e["difficulty"]: e["count"] for e in nums}
            all_count = difficulties.get("All", 0)
            easy      = difficulties.get("Easy", "?")
            medium    = difficulties.get("Medium", "?")
            hard      = difficulties.get("Hard", "?")
            print(f"  solved count query        → All={all_count}  Easy={easy}  Medium={medium}  Hard={hard}  ({elapsed:.2f}s)")

            if all_count == 0:
                report("leetcode", "warn", "0 problems solved or wrong username")
            else:
                report("leetcode", "pass", f"{all_count} problems solved")

        # 2. Contest history
        q_contests = {
            "operationName": "userContestRankingInfo",
            "query": """query userContestRankingInfo($username: String!) {
                userContestRankingHistory(username: $username) {
                    attended rating ranking
                    contest { title startTime }
                }
            }""",
            "variables": {"username": username}
        }
        data, elapsed = await _lc_post(session, url, q_contests, "contest history query")
        if data:
            if "errors" in data:
                print(f"  contest history query     → GraphQL errors: {data['errors']}  ({elapsed:.2f}s)")
            else:
                history = data.get("data", {}).get("userContestRankingHistory", [])
                attended = [e for e in history if e.get("attended")]
                latest   = attended[-1] if attended else None
                if latest:
                    title = latest["contest"]["title"][:35]
                    rating = int(latest["rating"])
                    print(f"  contest history query     → {len(attended)} attended, latest={title}, rating={rating}  ({elapsed:.2f}s)")
                else:
                    print(f"  contest history query     → 0 attended contests  ({elapsed:.2f}s)")


def test_leetcode(username):
    asyncio.run(test_leetcode_async(username))


# ══════════════════════════════════════════════════════════════════════════════
# CODECHEF
# ══════════════════════════════════════════════════════════════════════════════
def test_codechef(username):
    section(f"CodeChef  →  {username}")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }

    t = time.time()
    try:
        r = requests.get(
            f"https://www.codechef.com/users/{username}",
            headers=headers,
            timeout=15
        )
        elapsed = time.time() - t
        print(f"  profile page              → HTTP {r.status_code}  ({elapsed:.2f}s)")

        if r.status_code == 404:
            report("codechef", "fail", "user not found (404)")
            return
        if r.status_code != 200:
            report("codechef", "fail", f"HTTP {r.status_code}")
            return

        html = r.text

        # Check Method 1: embedded JSON script
        import re, json
        patterns = [
            ("var rating_data",    r'var\s+rating_data\s*=\s*(\[.*?\])\s*;'),
            ("ratingHistory JSON", r'"ratingHistory"\s*:\s*(\[.*?\])'),
            ("var all_rating",     r'var\s+all_rating\s*=\s*(\[.*?\])\s*;'),
        ]
        found_method = None
        parsed_data  = None
        for label, pat in patterns:
            m = re.search(pat, html, re.DOTALL)
            if m:
                try:
                    parsed_data = json.loads(m.group(1))
                    found_method = label
                    break
                except json.JSONDecodeError:
                    print(f"  {label:<25} → found but JSON parse failed")

        if parsed_data:
            print(f"  embedded JSON ({found_method:<14}) → {len(parsed_data)} contest entries found")
            if parsed_data:
                last = parsed_data[-1]
                rating   = last.get("rating") or last.get("new_rating", "?")
                contest  = (last.get("name") or last.get("code") or "?")[:35]
                print(f"  latest entry              → contest={contest}  rating={rating}")
            report("codechef", "pass", f"{len(parsed_data)} contest entries via embedded JSON")
            return

        # Check Method 2: graph data
        names_m  = re.search(r'contestName\s*[=:]\s*(\[.*?\])', html, re.DOTALL)
        rating_m = re.search(r'contestRating\s*[=:]\s*(\[.*?\])', html, re.DOTALL)
        if names_m and rating_m:
            names   = json.loads(names_m.group(1))
            ratings = json.loads(rating_m.group(1))
            print(f"  graph data method         → {len(names)} contest entries found")
            report("codechef", "pass", f"{len(names)} contest entries via graph data")
            return

        # Check Method 3: current rating only
        for pat in [r'"rating"\s*:\s*"?(\d+)"?', r'class="rating"[^>]*>\s*(\d+)']:
            m = re.search(pat, html)
            if m:
                print(f"  current rating fallback   → rating={m.group(1)} (no contest history)")
                report("codechef", "warn", f"only current rating={m.group(1)}, no contest history — CodeChef may have changed page structure")
                return

        print(f"  no data found             → page structure may have changed")
        report("codechef", "fail", "no rating data found in page — scraper may need updating")

    except Exception as e:
        print(f"  Exception: {e}")
        report("codechef", "fail", str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ATCODER
# ══════════════════════════════════════════════════════════════════════════════
def test_atcoder(username):
    section(f"AtCoder  →  {username}")

    headers = {"User-Agent": "CodeCracker/2.0"}

    # 1. Primary: atcoder.jp official history endpoint
    t = time.time()
    try:
        r = requests.get(
            f"https://atcoder.jp/users/{username}/history/json",
            headers=headers,
            timeout=12
        )
        elapsed = time.time() - t
        print(f"  atcoder.jp history/json   → HTTP {r.status_code}  ({elapsed:.2f}s)")
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list) and data:
                last = data[-1]
                contest    = last.get("ContestScreenName", "?")[:35]
                new_rating = last.get("NewRating", "?")
                print(f"  primary source            → {len(data)} contests, latest={contest}  new_rating={new_rating}")
                report("atcoder", "pass", f"{len(data)} contest entries via atcoder.jp")
                # No need to check fallback
                _test_atcoder_ac_count(username, headers)
                return
            elif isinstance(data, list):
                print(f"  primary source            → 0 contests (unrated account)")
                report("atcoder", "warn", "0 contests — account may be unrated or handle wrong")
        elif r.status_code == 404:
            print(f"  primary source            → user not found (404)")
    except Exception as e:
        print(f"  atcoder.jp history/json   → Exception: {e}")

    # 2. Fallback: kenkoooo contest history
    t = time.time()
    try:
        r = requests.get(
            "https://kenkoooo.com/atcoder/atcoder-api/v3/user/contest/history",
            params={"user": username},
            headers=headers,
            timeout=12
        )
        elapsed = time.time() - t
        print(f"  kenkoooo contest/history  → HTTP {r.status_code}  ({elapsed:.2f}s)")
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list) and data:
                print(f"  kenkoooo fallback         → {len(data)} entries")
                report("atcoder", "pass" if "atcoder" not in results else results["atcoder"],
                       f"{len(data)} entries via kenkoooo fallback")
            else:
                print(f"  kenkoooo fallback         → empty response")
                if "atcoder" not in results:
                    report("atcoder", "warn", "no data from either source")
    except Exception as e:
        print(f"  kenkoooo fallback         → Exception: {e}")
        if "atcoder" not in results:
            report("atcoder", "fail", str(e))

    _test_atcoder_ac_count(username, headers)


def _test_atcoder_ac_count(username, headers):
    t = time.time()
    try:
        r = requests.get(
            "https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank",
            params={"user": username},
            headers=headers,
            timeout=8
        )
        elapsed = time.time() - t
        if r.status_code == 200:
            data = r.json()
            count = data.get("count", 0)
            rank  = data.get("rank",  "?")
            print(f"  kenkoooo ac_rank          → AC count={count}  rank={rank}  ({elapsed:.2f}s)")
        else:
            print(f"  kenkoooo ac_rank          → HTTP {r.status_code}  ({elapsed:.2f}s)")
    except Exception as e:
        print(f"  kenkoooo ac_rank          → Exception: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
def print_summary():
    section("SUMMARY")
    icons = {"pass": "✅", "fail": "❌", "skip": "⏭ ", "warn": "⚠️ "}
    for platform, status in results.items():
        print(f"  {icons[status]}  {platform.capitalize():<12}  {status.upper()}")
    print()
    fails = [p for p, s in results.items() if s == "fail"]
    warns = [p for p, s in results.items() if s == "warn"]
    if not fails and not warns:
        print("  All platforms healthy 🎉")
    else:
        if fails:
            print(f"  Failing : {', '.join(fails)}")
        if warns:
            print(f"  Warnings: {', '.join(warns)}")
    print()


# ══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════
TESTS = {
    "codeforces": (test_codeforces, "codeforces"),
    "leetcode":   (test_leetcode,   "leetcode"),
    "codechef":   (test_codechef,   "codechef"),
    "atcoder":    (test_atcoder,    "atcoder"),
}

if __name__ == "__main__":
    filter_platform = sys.argv[1].lower() if len(sys.argv) > 1 else None

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║      CodeCracker — Platform Fetcher Health Check    ║")
    print("╚══════════════════════════════════════════════════════╝")

    for platform, (fn, key) in TESTS.items():
        if filter_platform and platform != filter_platform:
            continue
        handle = HANDLES.get(platform)
        if handle is None:
            section(f"{platform.capitalize()}  →  (skipped — no handle set)")
            report(platform, "skip", "set a handle in HANDLES dict to test")
            continue
        fn(handle)

    print_summary()
