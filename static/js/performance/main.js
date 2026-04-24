import { updateHistoryTable } from './statsUtils.js';
import { updateChart, renderPlatformToggles } from '../common/chartUtils.js';
import { initWebSocket, sendWebSocketMessage } from './websocket.js';

let username = null;
const lastDataRef = { current: null };
const REQUIRED_ELEMENTS = [
    'username-data', 'loading-spinner', 'chart-container', 'history-section',
    'notification', 'error-message'
];

document.addEventListener('DOMContentLoaded', function () {
    // Check for required DOM elements
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

    initWebSocket(username);
    fetchUserData(username);

    // Theme change observer
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            const wasDark = mutation.oldValue?.includes('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            if (mutation.attributeName === 'class' && wasDark !== isDark &&
                lastDataRef.current && window.chart) {
                updateChartColors(window.chart);
            }
        });
    });
    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
        attributeOldValue: true
    });
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
        updateChart(userData, null, username, null);
        updateHistoryTable(userData, null);

        // Show chart and history sections
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
            date: entry.date || '1970-01-01T00:00:00' // Ensure date exists
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

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;

    Object.assign(notification, {
        textContent: message,
        className: `notification ${type}`,
        style: { display: 'block' }
    });

    setTimeout(() => notification.style.display = 'none', 3000);
}

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    if (!errorMessage) return;

    Object.assign(errorMessage, {
        textContent: message,
        style: { display: 'block' }
    });

    setTimeout(() => errorMessage.style.display = 'none', 3000);
}

export { showError, showNotification };