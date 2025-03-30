// websocket.js
function initWebSocket(wsUrl, user1Username, getUser2Username, chart, updateStats, updateChart) {
    const ws = new WebSocket(wsUrl);

    ws.onopen = function () {
        console.log(`WebSocket connected for ${user1Username}`);
        document.getElementById('loading-spinner').style.display = 'block';
    };

    ws.onmessage = debounce(function (event) {
        const data = JSON.parse(event.data);
        console.log('Received WebSocket data:', data);
        document.getElementById('loading-spinner').style.display = 'none';

        if (data.error) {
            showError(data.error);
            return;
        }

        if (lastData && JSON.stringify(data) !== JSON.stringify(lastData)) {
            showNotification('Data updated!');
            animateStats();
        }
        lastData = data;

        const user2Username = getUser2Username();
        updateStats(data, user1Username, user2Username);
        updateChart(data, user1Username, user2Username);
    }, 300);

    ws.onclose = function () {
        console.log(`WebSocket disconnected for ${user1Username}`);
        showError('WebSocket connection lost. Please refresh the page.');
    };

    ws.onerror = function (error) {
        console.error('WebSocket error:', error);
        showError('An error occurred. Please try again later.');
    };

    return ws;
}