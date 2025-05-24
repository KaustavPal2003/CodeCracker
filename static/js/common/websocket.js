import { showError, showNotification, debounce, escapeHTML } from './utils.js';
import { animateStats } from '../compare/uiUtils.js';

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let pendingComparison = null;

// Debounce updateChart to prevent rapid chart recreation
const debouncedUpdateChart = debounce((user1Data, compareData, user1Username, user2Username, mode, callback) => {
    const chart = callback(user1Data, compareData, user1Username, user2Username, mode);
    return chart;
}, 100);

export function initWebSocket(username, mode = 'performance', { updateStats, updateHistoryTable, updateChart } = {}, url = null) {
    if (!('WebSocket' in window)) {
        console.error('WebSocket is not supported by this browser');
        showError('Your browser does not support WebSocket. Real-time updates are unavailable.');
        return null;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = url || `${wsProtocol}//${window.location.host}/ws/stats/${username}/`;
    ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    console.log(`WebSocket initialized for ${username} in ${mode} mode at ${wsUrl}`);

    ws.onopen = function () {
        console.log('WebSocket connection established');
        showNotification('Connected to real-time updates', 'success');
        reconnectAttempts = 0;
        if (mode === 'compare' && pendingComparison) {
            console.log('Resending pending comparison:', pendingComparison);
            sendWebSocketMessage(pendingComparison, mode);
        }
    };

    ws.onmessage = function (event) {
        try {
            let data;
            if (event.data instanceof ArrayBuffer) {
                if (!window.pako) {
                    console.error('Pako library is not loaded for decompression');
                    showError('Real-time updates unavailable: Compression library missing');
                    return;
                }
                const decompressedData = pako.inflate(new Uint8Array(event.data), { to: 'string' });
                data = JSON.parse(decompressedData);
            } else {
                data = JSON.parse(event.data);
            }
            console.log('WebSocket payload:', JSON.stringify(data, null, 2));

            if (data.error) {
                if (data.error.includes('Rate limit exceeded')) {
                    showNotification('Too many requests. Please wait a moment.', 'warning');
                } else {
                    showError(data.error);
                }
                const spinner = document.getElementById('loading-spinner');
                if (spinner) spinner.style.display = 'none';
                return;
            }

            const user1Data = data.user1;
            const compareData = mode === 'compare' ? data.compare_to || null : null;

            console.log('user1Data:', JSON.stringify(user1Data, null, 2));
            if (mode === 'compare') {
                console.log('compareData:', JSON.stringify(compareData, null, 2));
            }

            if (!user1Data) {
                console.warn('No user data received');
                showNotification('No user data available', 'warning');
                return;
            }

            if (mode === 'compare' && !compareData) {
                console.warn('No compareData received');
                showNotification('No comparison data available. Chart will only show User 1 data.', 'warning');
            }

            if (mode === 'compare' && updateStats) {
                updateStats('user1', user1Data);
                const user1Status = document.getElementById('user1-status');
                if (user1Status) user1Status.textContent = escapeHTML(user1Data.status || 'N/A');
                if (user1Data.has_no_ratings) {
                    showNotification(`${escapeHTML(user1Data.username)} has no ratings or contest history`, 'warning');
                }
            }

            if (mode === 'compare' && compareData && updateStats) {
                updateStats('user2', compareData);
                const compareStatus = document.getElementById('compare-status');
                if (compareStatus) compareStatus.textContent = escapeHTML(compareData.status || 'N/A');
                if (compareData.has_no_ratings) {
                    showNotification(`${escapeHTML(compareData.username)} has no ratings or contest history`, 'warning');
                } else if (compareData.error) {
                    showNotification(`Comparison error: ${escapeHTML(compareData.error)}`, 'warning');
                }
            }

            if (updateChart) {
                debouncedUpdateChart(user1Data, compareData, user1Data?.username, compareData?.username, mode, updateChart);
            }
            if (updateHistoryTable) {
                updateHistoryTable(user1Data, compareData, mode);
            }

            const chartContainer = document.getElementById('chart-container');
            const historySection = document.getElementById('history-section');
            const spinner = document.getElementById('loading-spinner');
            if (chartContainer) chartContainer.style.display = 'block';
            if (historySection) historySection.style.display = 'block';
            if (spinner) spinner.style.display = 'none';

            if (mode === 'compare') {
                const statsContainer = document.getElementById('stats-container');
                if (statsContainer) statsContainer.style.display = 'block';
                animateStats();
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
            showError(`Failed to process real-time update: ${error.message}`);
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.style.display = 'none';
        }
    };

    ws.onclose = function (event) {
        console.log('WebSocket closed with code:', event.code, 'reason:', event.reason);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.log(`Reconnecting in ${delay}ms... (Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(() => {
                reconnectAttempts++;
                initWebSocket(username, mode, { updateStats, updateHistoryTable, updateChart }, url);
            }, delay);
        } else {
            showError('Lost connection to server after multiple attempts. Please refresh the page.');
        }
    };

    ws.onerror = function (error) {
        console.error('WebSocket error:', error);
        showError('WebSocket connection error occurred');
    };

    return {
        ws,
        close: () => {
            if (ws) {
                ws.close(1000, 'Client closed connection');
                ws = null;
            }
        }
    };
}

export function sendWebSocketMessage(message, mode = 'performance') {
    return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            const error = new Error('WebSocket not connected');
            console.error('WebSocket is not open');
            showError('Cannot send update request: Connection is not active');
            if (mode === 'compare') pendingComparison = message;
            reject(error);
            return;
        }
        try {
            if (window.pako) {
                const compressedData = pako.deflate(JSON.stringify(message));
                ws.send(compressedData);
            } else {
                ws.send(JSON.stringify(message));
            }
            console.log('Sent WebSocket message:', message);
            resolve();
        } catch (error) {
            console.error('Error sending WebSocket message:', error);
            showError('Failed to send update request');
            if (mode === 'compare') pendingComparison = message;
            reject(error);
        }
    });
}