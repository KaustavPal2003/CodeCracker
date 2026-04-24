document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements with error handling
    const usernameElement = document.getElementById("username-data");
    const fetchUrlElement = document.getElementById("fetch-url");
    if (!usernameElement || !fetchUrlElement) {
        console.error("Missing critical DOM elements");
        return;
    }
    const username = usernameElement.dataset.username;
    const fetchUrl = fetchUrlElement.dataset.url;
    if (!username || !fetchUrl) {
        console.error("Missing username or fetch URL in dataset");
        return;
    }

    // WebSocket Setup with reconnection
    const wsUrl = `ws://${window.location.host}/ws/stats/${username}/`;
    let ws;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    function connectWebSocket() {
        ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            console.log(`WebSocket connected for ${username}`);
            reconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
            try {
                const decompressedData = pako.inflate(event.data, { to: 'string' });
                const data = JSON.parse(decompressedData);
                console.log("Received WebSocket data:", JSON.stringify(data, null, 2));
                updateStats(data);
                showNotification("Stats updated!", 2000);
            } catch (error) {
                console.error("Error processing WebSocket message:", error);
                showNotification("Error updating stats", 3000);
            }
        };

        ws.onclose = () => {
            console.log(`WebSocket disconnected for ${username}`);
            if (reconnectAttempts < maxReconnectAttempts) {
                setTimeout(() => {
                    console.log(`Reconnecting... Attempt ${reconnectAttempts + 1}`);
                    reconnectAttempts++;
                    connectWebSocket();
                }, 1000 * Math.pow(2, reconnectAttempts));
            }
        };

        ws.onerror = (error) => console.error("WebSocket error:", error);
    }

    connectWebSocket();
    let lastData = null;

    // Utility Functions
    function showNotification(message, duration = 3000) {
        const notification = document.getElementById("notification");
        if (!notification) return;
        notification.textContent = message;
        notification.classList.add('show');
        notification.style.display = "block";
        setTimeout(() => {
            notification.classList.remove('show');
            notification.style.display = "none";
        }, duration);
    }

    function formatValue(value) {
        return value !== undefined && value !== null ? value : "N/A";
    }

    function createHistoryTable(historySection) {
        const h3 = document.createElement("h3");
        h3.textContent = "Contest History";
        const container = document.createElement("div");
        container.className = "history-container";
        const table = document.createElement("table");
        table.className = "stats-table";
        table.id = "history-table";
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Platform</th>
                    <th>Contest</th>
                    <th>Rank</th>
                    <th>Old Rating</th>
                    <th>New Rating</th>
                    <th>Change</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody id="history-body"></tbody>
        `;
        container.appendChild(table);
        historySection.appendChild(h3);
        historySection.appendChild(container);
        return table.querySelector("#history-body");
    }

    // Main Update Function with optimization
    function updateStats(data) {
        const userData = data.user1 || {};
        const ratingHistory = userData.rating_history || data.rating_history || [];

        // Only update if data changed
        const currentDataStr = JSON.stringify(data);
        if (lastData && currentDataStr === JSON.stringify(lastData)) {
            return;
        }
        lastData = data;

        // Update Stats Summary
        const statsContainer = document.getElementById("stats-container");
        if (statsContainer) {
            statsContainer.innerHTML = `
                <p>Codeforces Rating: ${formatValue(userData.codeforces_rating)}</p>
                <p>LeetCode Solved: ${formatValue(userData.leetcode_solved)}</p>
                <p>LeetCode Contests: ${formatValue(userData.leetcode_contests)}</p>
                <p>LeetCode Rating: ${formatValue(userData.leetcode_rating)}</p>
                <p>CodeChef Rating: ${formatValue(userData.codechef_rating)}</p>
                <p>Data Status: ${formatValue(userData.status || data.status)}</p>
            `;
        }

        // Update History Table
        const historySection = document.getElementById("history-section");
        if (!historySection) return;

        let historyBody = document.getElementById("history-body");
        const noHistory = document.getElementById("no-history");
        if (noHistory) noHistory.remove();

        if (ratingHistory.length > 0) {
            if (!historyBody) {
                historyBody = createHistoryTable(historySection);
            }

            // Use DocumentFragment for better performance
            const fragment = document.createDocumentFragment();
            ratingHistory.forEach((entry) => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${username}</td>
                    <td>${formatValue(entry.platform)}</td>
                    <td>${formatValue(entry.contest)}</td>
                    <td>${formatValue(entry.rank)}</td>
                    <td>${formatValue(entry.old_rating)}</td>
                    <td>${formatValue(entry.new_rating)}</td>
                    <td class="${entry.change >= 0 ? 'positive' : 'negative'}">${formatValue(entry.change)}</td>
                    <td>${entry.date ? new Date(entry.date).toLocaleDateString() : "N/A"}</td>
                `;
                fragment.appendChild(row);
            });
            historyBody.innerHTML = "";
            historyBody.appendChild(fragment);
        } else if (!historyBody) {
            const noHistoryMsg = document.createElement("p");
            noHistoryMsg.id = "no-history";
            noHistoryMsg.className = "no-data";
            noHistoryMsg.textContent = "No contest history available.";
            historySection.appendChild(noHistoryMsg);
        }
    }

    // Initial fetch as fallback
    fetch(fetchUrl)
        .then(response => response.json())
        .then(data => updateStats(data))
        .catch(error => console.error("Initial fetch error:", error));
});