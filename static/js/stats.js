document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements with error handling
    const usernameElement = document.getElementById("username-data");
    const fetchUrlElement = document.getElementById("fetch-url");
    const statsContainer = document.getElementById("stats-container");
    const historySection = document.getElementById("history-section");
    const loadingSpinner = document.getElementById("loading-spinner");
    const statusMessage = document.getElementById("status-message");

    if (!usernameElement || !fetchUrlElement || !statsContainer || !historySection) {
        console.error("Missing critical DOM elements");
        showError("Failed to initialize: Missing required elements");
        return;
    }

    const username = usernameElement.dataset.username;
    const fetchUrl = fetchUrlElement.dataset.url;
    if (!username || !fetchUrl) {
        console.error("Missing username or fetch URL in dataset");
        showError("Failed to initialize: Missing configuration");
        return;
    }

    // WebSocket Setup with reconnection
    const wsUrl = `ws://${window.location.host}/ws/stats/${username}/`;
    let ws;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let isConnected = false;
    let lastData = null;

    function connectWebSocket() {
        if (ws) ws.close(); // Close existing connection
        ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            console.log(`WebSocket connected for ${username}`);
            isConnected = true;
            reconnectAttempts = 0;
            showLoading(false);
        };

        ws.onmessage = (event) => {
            try {
                const decompressedData = pako.inflate(event.data, { to: 'string' });
                const data = JSON.parse(decompressedData);
                console.log("Received WebSocket data:", JSON.stringify(data, null, 2));
                debouncedUpdateStats(data);
                showNotification("Stats and history updated!", 2000);
            } catch (error) {
                console.error("Error processing WebSocket message:", error);
                showError("Failed to process stats update");
            }
        };

        ws.onclose = () => {
            console.log(`WebSocket disconnected for ${username}`);
            isConnected = false;
            if (reconnectAttempts < maxReconnectAttempts) {
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                setTimeout(() => {
                    console.log(`Reconnecting... Attempt ${reconnectAttempts + 1}`);
                    reconnectAttempts++;
                    connectWebSocket();
                }, delay);
            } else {
                showError("Lost connection to server. Please try refreshing.");
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            showError("WebSocket connection error");
        };
    }

    // Utility Functions
    function showNotification(message, duration = 3000) {
        const notification = document.getElementById("notification");
        if (!notification) return;
        const timestamp = new Date().toLocaleTimeString();
        notification.innerHTML = `${message} <small>(${timestamp})</small>`;
        notification.classList.add('show');
        notification.style.display = "block";
        setTimeout(() => {
            notification.classList.remove('show');
            notification.style.display = "none";
        }, duration);
    }

    function showError(message) {
        const errorMessage = document.getElementById("error-message");
        if (!errorMessage) return;
        errorMessage.textContent = message;
        errorMessage.style.display = "block";
        showNotification(message, 5000);
    }

    function showLoading(isLoading) {
        if (loadingSpinner) {
            loadingSpinner.style.display = isLoading ? "block" : "none";
        }
        if (statusMessage) {
            statusMessage.style.display = isLoading ? "block" : "none";
        }
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
        historySection.innerHTML = "";
        historySection.appendChild(h3);
        historySection.appendChild(container);
        historySection.style.display = "block";
        return table.querySelector("#history-body");
    }

    // Pagination state
    let currentPage = 1;
    const entriesPerPage = 50;

    function updateHistoryTable(ratingHistory, page = 1) {
        let historyBody = document.getElementById("history-body");
        const noHistory = document.getElementById("no-history");
        if (noHistory) noHistory.remove();

        if (!historyBody) {
            historyBody = createHistoryTable(historySection);
        } else {
            historyBody.innerHTML = "";
        }

        historySection.style.display = "block";

        if (ratingHistory.length === 0) {
            const noHistoryMsg = document.createElement("p");
            noHistoryMsg.id = "no-history";
            noHistoryMsg.className = "no-data";
            noHistoryMsg.textContent = "No contest history available.";
            historySection.appendChild(noHistoryMsg);
            return;
        }

        // Paginate entries
        const start = (page - 1) * entriesPerPage;
        const end = start + entriesPerPage;
        const paginatedEntries = ratingHistory.slice(start, end);

        const fragment = document.createDocumentFragment();
        paginatedEntries.forEach((entry) => {
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
        historyBody.appendChild(fragment);

        // Remove existing showMoreContainer if it exists
        const existingShowMoreContainer = historySection.querySelector(".show-more-container");
        if (existingShowMoreContainer) {
            existingShowMoreContainer.remove();
        }

        // Add "Show More" button if more entries exist
        const showMoreContainer = document.createElement("div");
        showMoreContainer.className = "show-more-container";
        if (end < ratingHistory.length) {
            const showMoreButton = document.createElement("button");
            showMoreButton.className = "auth-button";
            showMoreButton.textContent = "Show More";
            showMoreContainer.style.display = "flex";
            showMoreContainer.style.justifyContent = "center";
            showMoreButton.addEventListener("click", () => {
                updateHistoryTable(ratingHistory, page + 1);
            });
            showMoreContainer.appendChild(showMoreButton);
        }
        historySection.appendChild(showMoreContainer);
    }

    // Debounce utility
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                requestAnimationFrame(() => func(...args));
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Main Update Function
    const updateStats = (data) => {
        // Skip if data hasn't changed
        const currentDataStr = JSON.stringify(data);
        if (lastData && currentDataStr === JSON.stringify(lastData)) {
            return;
        }
        lastData = data;

        showLoading(false);
        const userData = data.user1 || {};
        const ratingHistory = userData.rating_history || data.rating_history || [];

        // Update Stats Summary
        statsContainer.innerHTML = `
            <h3>${username}</h3>
            <p>Codeforces Rating: <span class="stat-value">${formatValue(userData.codeforces_rating)}</span></p>
            <p>LeetCode Solved: <span class="stat-value">${formatValue(userData.leetcode_solved)}</span></p>
            <p>LeetCode Contests: <span class="stat-value">${formatValue(userData.leetcode_contests)}</span></p>
            <p>LeetCode Rating: <span class="stat-value">${formatValue(userData.leetcode_rating)}</span></p>
            <p>CodeChef Rating: <span class="stat-value">${formatValue(userData.codechef_rating)}</span></p>
            <p>Data Status: <span class="stat-value">${formatValue(userData.status || data.status)}</span></p>
        `;
        statsContainer.style.display = "block";

        // Reset pagination
        currentPage = 1;
        updateHistoryTable(ratingHistory, currentPage);
    };

    const debouncedUpdateStats = debounce(updateStats, 250);

    // Initial fetch with retry
    let fetchRetries = 0;
    const maxFetchRetries = 3;

    function fetchStats() {
        showLoading(true);
        fetch(fetchUrl)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                fetchRetries = 0;
                debouncedUpdateStats(data);
            })
            .catch(error => {
                console.error("Fetch error:", error);
                if (fetchRetries < maxFetchRetries) {
                    fetchRetries++;
                    setTimeout(fetchStats, 2000 * fetchRetries);
                } else {
                    showError("Failed to load stats. Please try again later.");
                    showLoading(false);
                }
            });
    }

    // Initialize
    fetchStats();
    connectWebSocket();

    // Cleanup on page unload
    window.addEventListener('unload', () => {
        if (ws) ws.close();
    });
});