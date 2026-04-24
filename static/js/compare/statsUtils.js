import { showError } from './main.js';

const STATS_FIELDS = [
    { id: 'codeforces-rating', key: 'codeforces_rating', default: 'N/A' },
    { id: 'leetcode-solved', key: 'leetcode_solved', default: '0' },
    { id: 'leetcode-contests', key: 'leetcode_contests', default: '0' },
    { id: 'leetcode-rating', key: 'leetcode_rating', default: 'N/A' },
    { id: 'codechef-rating', key: 'codechef_rating', default: 'N/A' }
];

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
            usernameElement.textContent = stats.username || 'Unknown';
        } else {
            console.warn(`Username element ${prefix}user1-username not found`);
        }

        STATS_FIELDS.forEach(field => {
            const element = document.getElementById(`${prefix}${field.id}`);
            if (element) {
                element.textContent = stats[field.key] ?? field.default;
            } else {
                console.warn(`Element ${prefix}${field.id} not found`);
            }
        });

        const statusElement = document.getElementById(statusId);
        if (statusElement) {
            statusElement.textContent = stats.status || 'N/A';
        } else {
            console.warn(`Status element ${statusId} not found`);
        }

        container.style.display = 'block';
    } catch (error) {
        console.error(`Error updating stats for ${userPrefix}:`, error);
        showError(`Failed to update stats for ${stats.username || userPrefix}: ${error.message}`);
    }
}

function updateHistoryTable(user1Data, compareData = null) {
    const tbody = document.getElementById('history-body');
    const historySection = document.getElementById('history-section');

    if (!tbody || !historySection) {
        console.error('History table body or section not found');
        showError('Failed to update history table: Table elements missing');
        return;
    }

    tbody.innerHTML = '';

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

    histories.sort((a, b) => new Date(b.date) - new Date(a.date)); // Latest first
    histories.forEach(entry => {
        const row = document.createElement('tr');
        const ratingChange = (entry.new_rating && entry.old_rating)
            ? entry.new_rating - entry.old_rating
            : 'N/A';
        row.innerHTML = `
            <td>${entry.username || 'N/A'}</td>
            <td>${entry.platform || 'N/A'}</td>
            <td>${entry.contest || 'N/A'}</td>
            <td>${entry.rank || 'N/A'}</td>
            <td>${entry.old_rating ?? 'N/A'}</td>
            <td>${entry.new_rating ?? 'N/A'}</td>
            <td class="${ratingChange >= 0 ? 'positive' : 'negative'}">${ratingChange !== 'N/A' ? (ratingChange >= 0 ? '+' : '') + ratingChange : 'N/A'}</td>
            <td>${entry.date ? new Date(entry.date).toLocaleString() : 'N/A'}</td>
        `;
        tbody.appendChild(row);
    });

    historySection.style.display = 'block';
}

export { updateStats, updateHistoryTable };