import { updateHistoryTable } from '../common/statsUtils.js';
import { updateChart } from '../common/chartUtils.js';
import { initWebSocket } from '../common/websocket.js';
import { showError } from '../common/utils.js';

(function () {
    let username = null;
    const lastDataRef = { current: null };
    let chartInstance = null;
    const REQUIRED_ELEMENTS = [
        'username-data', 'loading-spinner', 'chart-container', 'history-section',
        'notification', 'error-message'
    ];

    document.addEventListener('DOMContentLoaded', function () {
        if (typeof moment === 'undefined') {
            console.error('Moment.js is not loaded');
            showError('Date handling library is missing. Some features may not work.');
        }

        const missingElement = REQUIRED_ELEMENTS.find(id => !document.getElementById(id));
        if (missingElement) {
            console.error(`Required element #${missingElement} not found`);
            showError(`Page setup error: missing element #${missingElement}`);
            return;
        }

        console.log('Script loaded successfully');
        console.log('Moment available:', typeof moment !== 'undefined' ? 'Yes' : 'No');
        console.log('Chart.js version:', typeof Chart !== 'undefined' ? Chart.version : 'Not loaded');
        console.log('Pako available:', typeof pako !== 'undefined' ? 'Yes' : 'No');

        username = document.getElementById('username-data')?.dataset.username;
        if (!username) {
            console.error('Username not found in dataset');
            showError('User not logged in. Please refresh the page.');
            return;
        }

        const wsInstance = initWebSocket(username, 'performance', {
            updateHistoryTable,
            updateChart: (user1Data, compareData, user1Username, user2Username, mode) => {
                if (chartInstance) {
                    chartInstance.cleanup();
                    console.log('Cleaned up existing chart instance in WebSocket update');
                }
                chartInstance = updateChart(user1Data, compareData, user1Username, user2Username, mode);
                return chartInstance;
            }
        });

        const cleanup = () => {
            console.log('Cleaning up Performance page resources');
            if (wsInstance?.close) {
                wsInstance.close();
                console.log('Closed WebSocket connection in cleanup');
            }
            if (chartInstance) {
                chartInstance.cleanup();
                chartInstance = null;
                console.log('Destroyed chart instance in cleanup');
            }
        };

        window.addEventListener('beforeunload', cleanup);
        fetchUserData(username).then(fetchedChart => {
            chartInstance = fetchedChart;
        });

        return cleanup;
    });

    async function fetchUserData(username) {
        const spinner = document.getElementById('loading-spinner');
        spinner.style.display = 'block';
        try {
            const fetchUrl = document.getElementById('fetch-url')?.dataset.url;
            if (!fetchUrl) throw new Error('Fetch URL not found in dataset');

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
            if (chartInstance) {
                chartInstance.cleanup();
                console.log('Cleaned up existing chart instance in fetchUserData');
            }
            chartInstance = updateChart(userData, null, username, null, 'performance');
            updateHistoryTable(userData, null, 'performance');

            ['chart-container', 'history-section'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.style.display = 'block';
            });

            return chartInstance;
        } catch (error) {
            console.error('Error fetching user data:', error);
            if (error.message.includes('HTTP')) {
                showError(`Server error: ${error.message}`);
            } else if (error.message.includes('Fetch URL')) {
                showError('Configuration error: Missing data URL');
            } else {
                showError(`Failed to load performance data: ${error.message}`);
            }
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
            if (Object.values(history).every(item => typeof item === 'object' && item.platform && item.contest)) {
                return Object.values(history).map(entry => ({
                    ...entry,
                    date: entry.date || '1970-01-01T00:00:00'
                }));
            }
        }
        console.error('Unexpected history format:', history);
        return [];
    }
})();