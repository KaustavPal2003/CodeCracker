// static/js/leaderboard.js
document.addEventListener('DOMContentLoaded', function () {
    let leaderboardData = [];
    try {
        const data = document.getElementById('leaderboard-data').textContent.trim();
        if (data) {
            leaderboardData = JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to parse leaderboard data:', error);
        showNotification('Error loading leaderboard data');
    }
    let currentPage = 1;
    const itemsPerPage = 10;
    let ws;
    let filteredData = [...leaderboardData];
    let sortKey = 'total_score';
    let isAscending = false;

    // WebSocket Setup
    try {
        const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/leaderboard/`;
        ws = new WebSocket(wsUrl);

        ws.onopen = function () {
            console.log('WebSocket connected for leaderboard');
            showNotification('Connected to live updates');
        };

        // Show spinner before WebSocket message
    ws.onmessage = throttle(function (event) {
    document.getElementById('loading-spinner').style.display = 'block';
    const data = JSON.parse(event.data);
    console.log('Received WebSocket data:', data);
    if (data.leaderboard_data) {
        leaderboardData = data.leaderboard_data;
        filteredData = [...leaderboardData];
        sortTable(sortKey, isAscending);
        showNotification('Leaderboard updated!');
    }
    document.getElementById('loading-spinner').style.display = 'none';
}, 1000);

        ws.onerror = function (error) {
            console.error('WebSocket error:', error);
            showNotification('Connection error occurred');
        };

        ws.onclose = function () {
    console.log('WebSocket disconnected for leaderboard. Attempting to reconnect...');
    setTimeout(() => {
        const newWs = new WebSocket(wsUrl);
        newWs.onopen = ws.onopen;
        newWs.onmessage = ws.onmessage;
        newWs.onclose = ws.onclose;
        newWs.onerror = ws.onerror;
        ws = newWs;
    }, 5000);
    showNotification('Connection lost. Attempting to reconnect...');
};
    } catch (error) {
        console.error('WebSocket initialization failed:', error);
        showNotification('Failed to connect to leaderboard updates');
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => ws?.close());

    function showNotification(message) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    function updateLeaderboard(data) {
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = '';
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const paginatedData = data.slice(start, end);

        paginatedData.forEach((entry, index) => {
            const row = document.createElement('tr');
            row.className = entry.username === '{{ request.user.username|escapejs }}' ? 'current-user' : '';
            row.innerHTML = `
                <td>${start + index + 1}</td>
                <td>${escapeHtml(entry.username)}</td>
                <td>${entry.codeforces_rating ?? 'N/A'}</td>
                <td>${entry.leetcode_solved ?? 0}</td>
                <td>${entry.codechef_rating ?? 'N/A'}</td>
                <td>${entry.total_score.toFixed(0)}</td>
            `;
            row.style.animation = 'fadeIn 0.5s ease-in';
            tbody.appendChild(row);
        });

        document.getElementById('page-info').textContent = `Page ${currentPage}`;
        document.getElementById('prev-page').disabled = currentPage === 1;
        document.getElementById('next-page').disabled = end >= data.length;
    }

    // Sorting Functionality
    const table = document.getElementById('leaderboard-table');
    table.querySelectorAll('th[data-sort]').forEach(header => {
        header.addEventListener('click', () => {
            sortKey = header.dataset.sort;
            isAscending = header.classList.toggle('asc');
            sortTable(sortKey, isAscending);
        });

        header.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                sortKey = header.dataset.sort;
                isAscending = header.classList.toggle('asc');
                sortTable(sortKey, isAscending);
            }
        });
    });

    function sortTable(key, ascending) {
        filteredData.sort((a, b) => {
            let aValue = a[key] ?? (key.includes('rating') ? -Infinity : 0);
            let bValue = b[key] ?? (key.includes('rating') ? -Infinity : 0);

            if (key === 'username') {
                return ascending
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }
            return ascending ? aValue - bValue : bValue - aValue;
        });
        currentPage = 1;
        updateLeaderboard(filteredData);
    }

    // Search Functionality with Debounce
    const searchInput = document.getElementById('leaderboard-search');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = searchInput.value.toLowerCase();
            filteredData = leaderboardData.filter(entry =>
                entry.username.toLowerCase().includes(query)
            );
            currentPage = 1;
            sortTable(sortKey, isAscending); // Reapply sort after filter
        }, 300);
    });

    // Pagination Controls
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updateLeaderboard(filteredData);
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        if (currentPage * itemsPerPage < filteredData.length) {
            currentPage++;
            updateLeaderboard(filteredData);
        }
    });

    // Utility Functions
    function throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            }
        };
    }

    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') {
            return String(unsafe || '');
        }
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Initial render handled by template, re-render if needed
    sortTable('total_score', false); // Initial sort by total_score descending
});