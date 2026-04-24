// static/js/leaderboard.js
document.addEventListener('DOMContentLoaded', function () {
    // ── Load data from embedded JSON block ─────────────────────────────
    let leaderboardData = [];
    try {
        const raw = document.getElementById('leaderboard-data').textContent.trim();
        if (raw) leaderboardData = JSON.parse(raw);
    } catch (e) {
        console.error('Failed to parse leaderboard data:', e);
        showNotification('Error loading leaderboard data');
    }

    let currentPage   = 1;
    const itemsPerPage = 10;
    let filteredData  = [...leaderboardData];
    let sortKey       = 'total_score';
    let isAscending   = false;

    // ── Grab logged-in username from the DOM (set by template) ─────────
    const currentUserEl = document.getElementById('current-username');
    const currentUser   = currentUserEl ? currentUserEl.dataset.username : '';

    // ── WebSocket for live updates ──────────────────────────────────────
    let ws;
    function connectWS() {
        try {
            const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
            ws = new WebSocket(`${proto}://${window.location.host}/ws/leaderboard/`);

            ws.onopen  = () => showNotification('Connected to live updates');
            ws.onerror = (e) => console.error('WebSocket error:', e);
            ws.onclose = () => setTimeout(connectWS, 5000);

            ws.onmessage = throttle(function (event) {
                const data = JSON.parse(event.data);
                if (data.leaderboard_data) {
                    leaderboardData = data.leaderboard_data;
                    filteredData    = [...leaderboardData];
                    sortTable(sortKey, isAscending);
                    showNotification('Leaderboard updated!');
                }
            }, 1000);
        } catch (e) {
            console.error('WebSocket init failed:', e);
        }
    }
    connectWS();
    window.addEventListener('beforeunload', () => ws?.close());

    // ── Render a page of the (filtered+sorted) data ────────────────────
    function updateLeaderboard(data) {
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = '';

        const start        = (currentPage - 1) * itemsPerPage;
        const end          = Math.min(start + itemsPerPage, data.length);
        const paginatedData = data.slice(start, end);

        if (!paginatedData.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;">No data found.</td></tr>';
        }

        paginatedData.forEach((entry, index) => {
            const row       = document.createElement('tr');
            row.className   = entry.username === currentUser ? 'current-user' : '';
            row.innerHTML   = `
                <td>${start + index + 1}</td>
                <td>${escapeHtml(entry.username)}</td>
                <td>${entry.codeforces_rating || '—'}</td>
                <td>${entry.leetcode_solved   || 0}</td>
                <td>${entry.codechef_rating   || '—'}</td>
                <td>${entry.atcoder_rating    || '—'}</td>
                <td>${(+entry.total_score).toFixed(0)}</td>
            `;
            tbody.appendChild(row);
        });

        document.getElementById('page-info').textContent = `Page ${currentPage}`;
        document.getElementById('prev-page').disabled = currentPage === 1;
        document.getElementById('next-page').disabled = end >= data.length;
    }

    // ── Column-click sorting ────────────────────────────────────────────
    document.querySelectorAll('#leaderboard-table th[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            sortKey     = th.dataset.sort;
            isAscending = th.classList.toggle('asc');
            sortTable(sortKey, isAscending);
        });
        th.addEventListener('keypress', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                sortKey     = th.dataset.sort;
                isAscending = th.classList.toggle('asc');
                sortTable(sortKey, isAscending);
            }
        });
    });

    function sortTable(key, ascending) {
        filteredData.sort((a, b) => {
            let av = a[key] ?? (key.includes('rating') ? -Infinity : 0);
            let bv = b[key] ?? (key.includes('rating') ? -Infinity : 0);
            if (key === 'username') return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
            return ascending ? av - bv : bv - av;
        });
        currentPage = 1;
        updateLeaderboard(filteredData);
    }

    // ── Search ──────────────────────────────────────────────────────────
    let searchTimeout;
    document.getElementById('leaderboard-search').addEventListener('input', function () {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const q  = this.value.toLowerCase();
            filteredData = leaderboardData.filter(e => e.username.toLowerCase().includes(q));
            currentPage  = 1;
            sortTable(sortKey, isAscending);
        }, 300);
    });

    // ── Pagination ──────────────────────────────────────────────────────
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; updateLeaderboard(filteredData); }
    });
    document.getElementById('next-page').addEventListener('click', () => {
        if (currentPage * itemsPerPage < filteredData.length) { currentPage++; updateLeaderboard(filteredData); }
    });

    // ── Helpers ─────────────────────────────────────────────────────────
    function throttle(fn, limit) {
        let throttled = false;
        return function (...args) {
            if (!throttled) { fn.apply(this, args); throttled = true; setTimeout(() => throttled = false, limit); }
        };
    }

    function escapeHtml(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                               .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    function showNotification(msg) {
        const el = document.getElementById('notification');
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 3000);
    }

    // ── Initial render ──────────────────────────────────────────────────
    sortTable('total_score', false);
});
