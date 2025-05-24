//codecracker\static\js\compare\websocket.js
import { showError, showNotification } from './main.js';
import { updateStats, updateHistoryTable } from './statsUtils.js';
import { updateChart } from './chartUtils.js';
import { animateStats } from './uiUtils.js';

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let pendingComparison = null;

export function initWebSocket(username) {
    if (!('WebSocket' in window)) {
        console.error('WebSocket is not supported by this browser');
        showError('Your browser does not support WebSocket. Real-time updates are unavailable.');
        return;
    }

    if (!window.pako) {
        console.error('Pako library not loaded');
        showError('Compression library missing. Real-time updates may fail.');
        return;
    }

    ws = new WebSocket(`ws://${window.location.host}/ws/stats/${username}/`);
    ws.binaryType = 'arraybuffer';
    console.log(`WebSocket initialized for ${username}`);

    ws.onopen = function() {
        console.log('WebSocket connection established');
        showNotification('Connected to real-time updates', 'success');
        reconnectAttempts = 0;
        if (pendingComparison) {
            console.log('Resending pending comparison:', pendingComparison);
            sendWebSocketMessage(pendingComparison);
        }
    };

    ws.onmessage = function(event) {
        try {
            let data;
            console.log('Received data type:', event.data instanceof ArrayBuffer ? 'ArrayBuffer' : 'String');

            if (event.data instanceof ArrayBuffer) {
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
            const compareData = data.compare_to || null;

            console.log('user1Data:', JSON.stringify(user1Data, null, 2));
            console.log('compareData:', JSON.stringify(compareData, null, 2));

            if (user1Data) {
                updateStats('user1', user1Data);
                const user1Status = document.getElementById('user1-status');
                if (user1Status) user1Status.textContent = user1Data.status || 'N/A';
                if (user1Data.has_no_ratings) {
                    showNotification(`${user1Data.username} has no ratings or contest history`, 'warning');
                }
            }

            if (compareData) {
                updateStats('user2', compareData);
                const compareStatus = document.getElementById('compare-status');
                if (compareStatus) compareStatus.textContent = compareData.status || 'N/A';
                if (compareData.has_no_ratings) {
                    showNotification(`${compareData.username} has no ratings or contest history`, 'warning');
                } else if (compareData.error) {
                    showNotification(`Comparison error: ${compareData.error}`, 'warning');
                }
            } else {
                console.warn('No compareData received');
                showNotification('No comparison data available', 'warning');
            }

            updateHistoryTable(user1Data, compareData);
            updateChart(user1Data, compareData, user1Data?.username, compareData?.username);
            animateStats();

            const statsContainer = document.getElementById('stats-container');
            const chartContainer = document.getElementById('chart-container');
            const historySection = document.getElementById('history-section');
            const spinner = document.getElementById('loading-spinner');
            if (statsContainer) statsContainer.style.display = 'block';
            if (chartContainer) chartContainer.style.display = 'block';
            if (historySection) historySection.style.display = 'block';
            if (spinner) spinner.style.display = 'none';
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
            showError(`Failed to process real-time update: ${error.message}`);
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.style.display = 'none';
        }
    };

    ws.onclose = function(event) {
        console.log('WebSocket closed with code:', event.code, 'reason:', event.reason);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && event.code !== 1000) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.log(`Reconnecting in ${delay}ms... (Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(() => {
                reconnectAttempts++;
                initWebSocket(username);
            }, delay);
        } else {
            showError('Lost connection to server after multiple attempts or intentional closure. Please refresh the page.');
        }
    };

    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        showError('WebSocket connection error occurred');
    };
}

export function sendWebSocketMessage(message) {
    return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            const error = new Error('WebSocket not connected');
            console.error('WebSocket is not open');
            showError('Cannot send update request: Connection is not active');
            pendingComparison = message; // Store for retry
            reject(error);
            return;
        }

        try {
            const jsonData = JSON.stringify(message);
            const compressedData = pako.deflate(jsonData);
            ws.send(compressedData);
            console.log('Sent WebSocket message:', message);
            resolve();
        } catch (error) {
            console.error('Error sending WebSocket message:', error);
            showError('Failed to send update request');
            pendingComparison = message; // Store for retry
            reject(error);
        }
    });
}