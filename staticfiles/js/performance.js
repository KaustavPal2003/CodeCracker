let chartInstance = null;

async function fetchRatingHistory(username, fetchUrl, compareUsername = null) {
    try {
        console.log("Fetching rating history for:", username, "Compare with:", compareUsername || "None");
        const url = compareUsername ? `${fetchUrl}?compare_to=${compareUsername}` : fetchUrl;
        const response = await fetch(url);
        console.log("Response status:", response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Fetched data:", data);

        document.getElementById("loading").style.display = "none";

        if (data.error) {
            console.error("Server error:", data.error);
            document.getElementById("chart-container").style.display = "none";
            document.getElementById("error-message").innerHTML = '<p class="error-message">Failed to load performance data: ' + data.error + '</p>';
            return;
        }

        document.getElementById("chart-container").style.display = "block";
        document.getElementById("error-message").innerHTML = '';

        const userPlatforms = {};
        data.rating_history.forEach(entry => {
            if (!userPlatforms[entry.platform]) {
                userPlatforms[entry.platform] = { dates: [], ratings: [] };
            }
            userPlatforms[entry.platform].dates.push(new Date(entry.date || "1970-01-01T00:00:00"));
            userPlatforms[entry.platform].ratings.push(entry.new_rating || 0);
        });

        const comparePlatforms = {};
        if (data.compare_rating_history) {
            data.compare_rating_history.forEach(entry => {
                if (!comparePlatforms[entry.platform]) {
                    comparePlatforms[entry.platform] = { dates: [], ratings: [] };
                }
                comparePlatforms[entry.platform].dates.push(new Date(entry.date || "1970-01-01T00:00:00"));
                comparePlatforms[entry.platform].ratings.push(entry.new_rating || 0);
            });
        }

        if (chartInstance) {
            chartInstance.destroy();
        }

        const ctx = document.getElementById("ratingChart").getContext("2d");
        chartInstance = new Chart(ctx, {
            type: "line",
            data: {
                datasets: [
                    { 
                        label: `${username} Codeforces`, 
                        data: userPlatforms["Codeforces"]?.ratings.map((r, i) => ({ x: userPlatforms["Codeforces"].dates[i], y: r })) || [], 
                        borderColor: "blue", 
                        fill: false,
                        tension: 0.1
                    },
                    { 
                        label: `${compareUsername || "..."} Codeforces`, 
                        data: comparePlatforms["Codeforces"]?.ratings.map((r, i) => ({ x: comparePlatforms["Codeforces"].dates[i], y: r })) || [], 
                        borderColor: "red", 
                        fill: false,
                        tension: 0.1,
                        hidden: !comparePlatforms["Codeforces"]
                    },
                    { 
                        label: `${username} CodeChef`, 
                        data: userPlatforms["CodeChef"]?.ratings.map((r, i) => ({ x: userPlatforms["CodeChef"].dates[i], y: r })) || [], 
                        borderColor: "green", 
                        fill: false,
                        tension: 0.1
                    },
                    { 
                        label: `${compareUsername || "..."} CodeChef`, 
                        data: comparePlatforms["CodeChef"]?.ratings.map((r, i) => ({ x: comparePlatforms["CodeChef"].dates[i], y: r })) || [], 
                        borderColor: "orange", 
                        fill: false,
                        tension: 0.1,
                        hidden: !comparePlatforms["CodeChef"]
                    },
                    { 
                        label: `${username} LeetCode`, 
                        data: userPlatforms["LeetCode"]?.ratings.map((r, i) => ({ x: userPlatforms["LeetCode"].dates[i], y: r })) || [], 
                        borderColor: "purple", 
                        fill: false,
                        tension: 0.1
                    },
                    { 
                        label: `${compareUsername || "..."} LeetCode`, 
                        data: comparePlatforms["LeetCode"]?.ratings.map((r, i) => ({ x: comparePlatforms["LeetCode"].dates[i], y: r })) || [], 
                        borderColor: "pink", 
                        fill: false,
                        tension: 0.1,
                        hidden: !comparePlatforms["LeetCode"]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { 
                        title: { display: true, text: "Date", color: "#2c3e50" }, 
                        type: "time", 
                        time: { unit: "month" },
                        ticks: { color: "#7f8c8d" }
                    },
                    y: { 
                        title: { display: true, text: "Rating", color: "#2c3e50" }, 
                        beginAtZero: true,
                        ticks: { color: "#7f8c8d" }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: "top",
                        labels: {
                            color: "#2c3e50",
                            font: { size: 14 }
                        }
                    },
                    tooltip: {
                        mode: "index",
                        intersect: false,
                        backgroundColor: "rgba(44, 62, 80, 0.8)",
                        titleColor: "#fff",
                        bodyColor: "#fff"
                    }
                },
                hover: {
                    mode: "nearest",
                    intersect: true
                }
            }
        });
    } catch (err) {
        console.error("Fetch error:", err.message);
        document.getElementById("loading").style.display = "none";
        document.getElementById("chart-container").style.display = "none";
        document.getElementById("error-message").innerHTML = '<p class="error-message">Failed to load performance data: ' + err.message + '</p>';
    }
}

// Initialize the chart on page load
document.addEventListener("DOMContentLoaded", () => {
    const username = document.getElementById("username-data").dataset.username;
    const fetchUrl = document.getElementById("fetch-url").dataset.url;
    fetchRatingHistory(username, fetchUrl);

    // Handle form submission for comparison
    document.getElementById("compare-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const compareUsername = document.getElementById("compare_username").value.trim();
        if (compareUsername) {
            document.getElementById("loading").style.display = "block";
            document.getElementById("chart-container").style.display = "none";
            document.getElementById("error-message").innerHTML = '';
            await fetchRatingHistory(username, fetchUrl, compareUsername);
            document.querySelector("h2").textContent = `📈 Performance Trend for ${username} vs ${compareUsername}`;
        }
    });
});