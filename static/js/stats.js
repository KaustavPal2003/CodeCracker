document.addEventListener('DOMContentLoaded', function() {
    const username = document.getElementById("username-data").dataset.username;
    const fetchUrl = document.getElementById("fetch-url").dataset.url;
    const wsUrl = `ws://${window.location.host}/ws/stats/${username}/`;
    const ws = new WebSocket(wsUrl);

    let lastData = null;

    ws.onopen = function() {
        console.log(`WebSocket connected for ${username}`);
    };

    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        console.log("Received WebSocket data:", data);

        // Check for changes
        if (lastData) {
            if (JSON.stringify(data) !== JSON.stringify(lastData)) {
                showNotification("Data updated!");
            }
        }
        lastData = data;

        // Update stats
        updateStats(data);
    };

    ws.onclose = function() {
        console.log(`WebSocket disconnected for ${username}`);
    };

    ws.onerror = function(error) {
        console.error("WebSocket error:", error);
    };

    function showNotification(message) {
        const notification = document.getElementById("notification");
        notification.textContent = message;
        notification.style.display = "block";
        setTimeout(() => {
            notification.style.display = "none";
        }, 3000);
    }

    function updateStats(data) {
        // Update main user's stats
        document.querySelector("#stats-container p:nth-child(1)").textContent = `Codeforces Rating: ${data.codeforces_rating !== "N/A" ? data.codeforces_rating : "N/A"}`;
        document.querySelector("#stats-container p:nth-child(2)").textContent = `LeetCode Solved: ${data.leetcode_solved}`;
        document.querySelector("#stats-container p:nth-child(3)").textContent = `CodeChef Rating: ${data.codechef_rating !== "N/A" ? data.codechef_rating : "N/A"}`;

        // Update history
        const historyBody = document.getElementById("history-body");
        const noHistory = document.getElementById("no-history");
        const historySection = document.getElementById("history-section");
        historyBody.innerHTML = "";
        if (noHistory) noHistory.remove();

        // Add main user's history
        if (data.rating_history && data.rating_history.length > 0) {
            data.rating_history.forEach(entry => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${entry.platform}</td>
                    <td>${entry.contest}</td>
                    <td>${entry.rank || "N/A"}</td>
                    <td>${entry.old_rating || "N/A"}</td>
                    <td>${entry.new_rating || "N/A"}</td>
                    <td>${entry.change || "N/A"}</td>
                    <td>${entry.date.slice(0, 10)}</td>
                `;
                historyBody.appendChild(row);
            });
        }

        if (!data.rating_history) {
            const noHistoryMsg = document.createElement("p");
            noHistoryMsg.id = "no-history";
            noHistoryMsg.className = "no-data";
            noHistoryMsg.textContent = "No contest history available.";
            historySection.appendChild(noHistoryMsg);
        }
    }
});