import { showError } from "./utils.js";

export const STATS_FIELDS = [
    { id: 'codeforces-rating', key: 'codeforces_rating', default: 'N/A' },
    { id: 'leetcode-solved', key: 'leetcode_solved', default: '0' },
    { id: 'leetcode-contests', key: 'leetcode_contests', default: '0' },
    { id: 'leetcode-rating', key: 'leetcode_rating', default: 'N/A' },
    { id: 'codechef-rating', key: 'codechef_rating', default: 'N/A' }
];

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    const dateObj = new Date(dateStr);
    return !isNaN(dateObj.getTime())
        ? dateObj.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        : 'N/A';
}

function updateStats(userPrefix, stats) {
    const prefixMap = { user1: '', user2: 'compare-' };
    const prefix = prefixMap[userPrefix] || '';
    const containerId = prefix ? 'compare-section' : 'user1-stats';
    const statusId = prefix ? 'compare-status' : 'user1-status';

    if (!stats) {
        console.error(`Stats data is undefined for ${userPrefix}`);
        showError(`Failed to update stats for ${userPrefix}: No data provided`);
        return;
    }

    try {
        const container = document.getElementById(containerId);
        if (!container) throw new Error(`Container ${containerId} not found`);

        const usernameElement = document.getElementById(`${prefix}user1-username`);
        if (usernameElement) {
            usernameElement.textContent = escapeHTML(stats.username || 'Unknown');
        } else {
            console.warn(`Username element ${prefix}user1-username not found`);
        }

        STATS_FIELDS.forEach(field => {
            const element = document.getElementById(`${prefix}${field.id}`);
            if (element) {
                element.textContent = escapeHTML(String(stats[field.key] ?? field.default));
            } else {
                console.warn(`Element ${prefix}${field.id} not found`);
            }
        });

        const statusElement = document.getElementById(statusId);
        if (statusElement) {
            statusElement.textContent = escapeHTML(stats.status || 'N/A');
        } else {
            console.warn(`Status element ${statusId} not found`);
        }

        container.style.display = 'block';
    } catch (error) {
        console.error(`Error updating stats for ${userPrefix}:`, error);
        showError(`Failed to update stats for ${stats.username || userPrefix}: ${error.message}`);
    }
}

function updateHistoryTable(user1Data, compareData = null, mode = 'compare') {
    const tbody = document.getElementById('history-body');
    const historySection = document.getElementById('history-section');

    if (!tbody || !historySection) {
        console.error('History table body or section not found');
        showError('Failed to update history table: Table elements missing');
        return;
    }

    tbody.innerHTML = '';

    if (mode === 'compare') {
        const histories = [];
        if (user1Data?.rating_history) {
            histories.push(...user1Data.rating_history.map(entry => ({ ...entry, username: user1Data.username })));
        }
        if (compareData?.rating_history) {
            histories.push(...compareData.rating_history.map(entry => ({ ...entry, username: compareData.username })));
        }

        if (histories.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">No contest history available.</td></tr>';
            historySection.style.display = 'block';
            return;
        }

        histories.sort((a, b) => {
            const dateA = new Date(a.date) || new Date(0);
            const dateB = new Date(b.date) || new Date(0);
            return dateB - dateA;
        });

        histories.forEach(entry => {
            if (!entry.platform || !entry.contest || !entry.date) {
                console.warn(`Incomplete entry for ${entry.username || 'unknown'}:`, entry);
                return;
            }
            const row = document.createElement('tr');
            if (!('old_rating' in entry)) {
                console.warn(`Missing old_rating for entry:`, entry);
                entry.old_rating = 0;
            }
            if (!('new_rating' in entry)) {
                console.warn(`Missing new_rating for entry:`, entry);
                entry.new_rating = 'N/A';
            }
            const ratingChange = 'change' in entry ? entry.change : (entry.new_rating && entry.old_rating !== undefined ? entry.new_rating - entry.old_rating : 'N/A');
            const formattedDate = formatDate(entry.date);

            row.innerHTML = `
                <td>${escapeHTML(entry.username || 'N/A')}</td>
                <td>${escapeHTML(entry.platform || 'N/A')}</td>
                <td>${escapeHTML(entry.contest || 'N/A')}</td>
                <td>${escapeHTML(String(entry.rank || 'N/A'))}</td>
                <td>${escapeHTML(String(entry.old_rating ?? 'N/A'))}</td>
                <td>${escapeHTML(String(entry.new_rating ?? 'N/A'))}</td>
                <td class="${ratingChange >= 0 ? 'positive' : 'negative'}">${escapeHTML(ratingChange !== 'N/A' ? (ratingChange >= 0 ? '+' : '') + ratingChange : 'N/A')}</td>
                <td>${escapeHTML(formattedDate)}</td>
            `;
            tbody.appendChild(row);
        });
    } else {
        const history = user1Data?.rating_history || [];
        if (!Array.isArray(history) || history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No contest history available.</td></tr>';
            historySection.style.display = 'block';
            return;
        }

        history.sort((a, b) => {
            const dateA = new Date(a.date) || new Date(0);
            const dateB = new Date(b.date) || new Date(0);
            return dateB - dateA;
        });

        history.forEach(entry => {
            if (!entry.platform || !entry.contest || !entry.date) {
                console.warn(`Incomplete entry:`, entry);
                return;
            }
            const row = document.createElement('tr');
            const formattedDate = formatDate(entry.date);
            row.innerHTML = `
                <td>${escapeHTML(entry.platform || 'N/A')}</td>
                <td>${escapeHTML(entry.contest || 'N/A')}</td>
                <td>${escapeHTML(formattedDate)}</td>
                <td>${escapeHTML(String(entry.new_rating ?? 'N/A'))}</td>
                <td>${escapeHTML(String(entry.rank || 'N/A'))}</td>
            `;
            tbody.appendChild(row);
        });
    }

    historySection.style.display = 'block';
}

export { updateStats, updateHistoryTable };