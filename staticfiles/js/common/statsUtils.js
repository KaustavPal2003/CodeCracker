// E:\Best_project\codecracker\static\js\compare\statsUtils.js
import { showError } from "./utils.js";

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

function updateHistoryTable(user1Data, compareData = null, mode = 'compare') { // Default to 'compare' mode
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
            const dateObj = new Date(entry.date);
            const formattedDate = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A';

            console.log(`Rendering entry for ${entry.username || 'unknown'}:`, {
                username: entry.username || 'N/A',
                platform: entry.platform || 'N/A',
                contest: entry.contest || 'N/A',
                rank: entry.rank || 'N/A',
                old_rating: entry.old_rating ?? 'N/A',
                new_rating: entry.new_rating ?? 'N/A',
                ratingChange: ratingChange !== 'N/A' ? (ratingChange >= 0 ? '+' : '') + ratingChange : 'N/A',
                date: formattedDate
            });

            row.innerHTML = `
                <td>${entry.username || 'N/A'}</td>
                <td>${entry.platform || 'N/A'}</td>
                <td>${entry.contest || 'N/A'}</td>
                <td>${entry.rank || 'N/A'}</td>
                <td>${entry.old_rating ?? 'N/A'}</td>
                <td>${entry.new_rating ?? 'N/A'}</td>
                <td class="${ratingChange >= 0 ? 'positive' : 'negative'}">${ratingChange !== 'N/A' ? (ratingChange >= 0 ? '+' : '') + ratingChange : 'N/A'}</td>
                <td>${formattedDate}</td>
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
            const row = document.createElement('tr');
            const dateObj = new Date(entry.date);
            const formattedDate = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A';
            row.innerHTML = `
                <td>${entry.platform || 'N/A'}</td>
                <td>${entry.contest || 'N/A'}</td>
                <td>${formattedDate}</td>
                <td>${entry.new_rating ?? 'N/A'}</td>
                <td>${entry.rank || 'N/A'}</td>
            `;
            tbody.appendChild(row);
        });
    }

    historySection.style.display = 'block';
}

export { updateStats, updateHistoryTable };