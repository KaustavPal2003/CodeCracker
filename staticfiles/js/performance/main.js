// codecracker/static/js/performance/main.js
import { updateHistoryTable } from '../common/statsUtils.js';
import { updateChart } from '../common/chartUtils.js'; // Updated import
import { initWebSocket } from '../common/websocket.js';
import { showError } from '../common/utils.js';

let username = null;
const lastDataRef = { current: null };
const REQUIRED_ELEMENTS = [
    'username-data', 'loading-spinner', 'chart-container', 'history-section',
    'notification', 'error-message'
];

document.addEventListener('DOMContentLoaded', function () {
    const missingElement = REQUIRED_ELEMENTS.find(id => !document.getElementById(id));
    if (missingElement) {
        console.error(`Required element #${missingElement} not found`);
        showError(`Page setup error: missing element #${missingElement}`);
        return;
    }

    console.log('Script loaded successfully');
    console.log('Moment available:', typeof moment !== 'undefined' ? 'Yes' : 'No');
    console.log('Chart.js version:', Chart.version);
    console.log('Pako available:', typeof pako !== 'undefined' ? 'Yes' : 'No');

    username = document.getElementById('username-data')?.dataset.username;
    if (!username) {
        console.error('Username not found in dataset');
        showError('User not logged in. Please refresh the page.');
        return;
    }

    initWebSocket(username, 'performance', { updateHistoryTable, updateChart });
    fetchUserData(username);
});

async function fetchUserData(username) {
    const spinner = document.getElementById('loading-spinner');
    spinner.style.display = 'block';

    try {
        const fetchUrl = document.getElementById('fetch-url')?.dataset.url;
        if (!fetchUrl) {
            throw new Error('Fetch URL not found in dataset');
        }

        const response = await fetch(fetchUrl, {
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (!data?.user1) {
            throw new Error('Invalid response data: missing user1 field');
        }

        const userData = {
            username: data.user1.username || username,
            rating_history: normalizeHistory(data.user1.rating_history)
        };

        lastDataRef.current = userData;
        updateChart(userData, null, username, null, 'performance'); // Specify mode
        updateHistoryTable(userData, null, 'performance');

        ['chart-container', 'history-section'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'block';
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        showError(`Failed to load performance data: ${error.message}`);
    } finally {
        spinner.style.display = 'none';
    }
}

function normalizeHistory(history) {
    if (!history) {
        console.warn('No history provided');
        return [];
    }

    if (Array.isArray(history)) {
        return history.map(entry => ({
            ...entry,
            date: entry.date || '1970-01-01T00:00:00'
        }));
    }

    if (typeof history === 'object' && history !== null) {
        if (history.rating_history && Array.isArray(history.rating_history)) {
            return history.rating_history.map(entry => ({
                ...entry,
                date: entry.date || '1970-01-01T00:00:00'
            }));
        }

        const values = Object.values(history);
        if (values.every(item => typeof item === 'object' && item.platform && item.contest)) {
            return values.map(entry => ({
                ...entry,
                date: entry.date || '1970-01-01T00:00:00'
            }));
        }
    }

    console.warn('History in unexpected format:', history);
    return [];
}