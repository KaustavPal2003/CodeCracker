# tracker/views/user_management_views.py
from django.shortcuts import render, redirect
from tracker.models import UserStats


def add_user(request):
    if request.method == "POST":
        try:
            username = request.POST.get("username")
            codeforces_rating = int(request.POST.get("codeforces_rating", 0))
            leetcode_solved = int(request.POST.get("leetcode_solved", 0))
            codechef_rating = int(request.POST.get("codechef_rating", 0))
            if not username:
                return render(request, "tracker/add_user.html", {"error": "Username is required"})
            new_user = UserStats(
                username=username,
                codeforces_rating=codeforces_rating,
                leetcode_solved=leetcode_solved,
                codechef_rating=codechef_rating
            )
            new_user.save()
            return redirect("tracker:home")
        except ValueError:
            return render(request, "tracker/add_user.html", {"error": "Invalid rating values"})
        except Exception as e:
            return render(request, "tracker/add_user.html", {"error": str(e)})
    return render(request, "tracker/add_user.html")