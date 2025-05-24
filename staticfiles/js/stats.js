// stats.js
document.addEventListener('DOMContentLoaded', () => {
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
            const statusMessage = document.getElementById("status-message");
            if (statusMessage) statusMessage.style.display = "none";
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

    function updateStats(data) {
        const userData = data.user1 || data;
        const ratingHistory = userData.rating_history || [];

        const currentDataStr = JSON.stringify(userData);
        if (lastData && currentDataStr === JSON.stringify(lastData)) {
            return;
        }
        lastData = userData;

        const statsContainer = document.getElementById("stats-container");
        if (statsContainer) {
            statsContainer.style.display = "block";
            const codeforcesRating = document.getElementById("codeforces-rating");
            const leetcodeSolved = document.getElementById("leetcode-solved");
            const leetcodeContests = document.getElementById("leetcode-contests");
            const leetcodeRating = document.getElementById("leetcode-rating");
            const codechefRating = document.getElementById("codechef-rating");
            const userStatus = document.getElementById("user1-status");

            if (codeforcesRating) codeforcesRating.textContent = formatValue(userData.codeforces_rating);
            if (leetcodeSolved) leetcodeSolved.textContent = formatValue(userData.leetcode_solved);
            if (leetcodeContests) leetcodeContests.textContent = formatValue(userData.leetcode_contests);
            if (leetcodeRating) leetcodeRating.textContent = formatValue(userData.leetcode_rating);
            if (codechefRating) codechefRating.textContent = formatValue(userData.codechef_rating);
            if (userStatus) userStatus.textContent = formatValue(userData.status) || "Updated";
        } else {
            console.error("stats-container not found in DOM");
        }

        const historySection = document.getElementById("history-section");
        const historyBody = document.getElementById("history-body");
        const noHistoryRow = document.getElementById("no-history-row");

        if (historySection && historyBody && noHistoryRow) {
            historySection.style.display = "block";

            if (ratingHistory.length > 0) {
                // Optimize for large datasets with batch processing
                const fragment = document.createDocumentFragment();
                ratingHistory.forEach((entry) => {
                    const row = document.createElement("tr");
                    row.innerHTML = `
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
                historyBody.innerHTML = "";  // Clear existing content
                historyBody.appendChild(fragment);  // Append all at once
                noHistoryRow.style.display = "none";
            } else {
                noHistoryRow.style.display = "table-row";
            }
        }
    }

    fetch(fetchUrl)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => updateStats(data))
        .catch(error => {
            console.error("Initial fetch error:", error);
            const errorMessage = document.getElementById("error-message");
            if (errorMessage) {
                errorMessage.textContent = "Failed to load stats: " + error.message;
                errorMessage.style.display = "block";
            }
            const statusMessage = document.getElementById("status-message");
            if (statusMessage) statusMessage.style.display = "none";
        });
});