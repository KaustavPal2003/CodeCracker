import { showError, showNotification } from './main.js';
import { updateHistoryTable } from './statsUtils.js';
import { updateChart } from './chartUtils.js';

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export function initWebSocket(username) {
    if (!('WebSocket' in window)) {
        console.error('WebSocket not supported');
        showError('Your browser does not support WebSocket.');
        return;
    }

    if (!window.pako) {
        console.error('Pako library not loaded');
        showError('Compression library missing.');
        return;
    }

    ws = new WebSocket(`ws://${window.location.host}/ws/stats/${username}/`);
    ws.binaryType = 'arraybuffer';

    ws.onopen = function() {
        console.log('WebSocket connection established');
        showNotification('Connected to real-time updates', 'success');
        reconnectAttempts = 0;
    };

    ws.onmessage = function(event) {
        try {
            let data;
            if (event.data instanceof ArrayBuffer) {
                data = JSON.parse(pako.inflate(new Uint8Array(event.data), { to: 'string' }));
            } else {
                data = JSON.parse(event.data);
            }

            if (data.error) {
                showError(data.error);
                return;
            }

            const userData = data.user1;
            if (!userData) {
                console.warn('No user data received');
                return;
            }

            updateChart(userData, null, userData.username, null);
            updateHistoryTable(userData, null);

            const chartContainer = document.getElementById('chart-container');
            const historySection = document.getElementById('history-section');
            const spinner = document.getElementById('loading-spinner');
            if (chartContainer) chartContainer.style.display = 'block';
            if (historySection) historySection.style.display = 'block';
            if (spinner) spinner.style.display = 'none';
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
            showError(`Failed to process update: ${error.message}`);
        }
    };

    ws.onclose = function(event) {
        console.log('WebSocket closed:', event.code, event.reason);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && event.code !== 1000) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            setTimeout(() => {
                reconnectAttempts++;
                initWebSocket(username);
            }, delay);
        } else {
            showError('Lost connection to server.');
        }
    };

    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        showError('Connection error occurred');
    };
}

export function sendWebSocketMessage(message) {
    return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket not connected'));
            return;
        }

        try {
            const compressedData = pako.deflate(JSON.stringify(message));
            ws.send(compressedData);
            resolve();
        } catch (error) {
            console.error('Error sending message:', error);
            reject(error);
        }
    });
}