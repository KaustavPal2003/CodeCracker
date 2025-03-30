function initWebSocket(wsUrl, user1Username, getUser2Username, chart, updateStats, updateChart) {
    const ws = new WebSocket(wsUrl);

    ws.onopen = function () {
        console.log(`WebSocket connected for ${user1Username}`);
        // Spinner is handled in main.js, no need to show it here
    };

    ws.onmessage = debounce(function (event) {
        const data = JSON.parse(event.data);
        console.log('Received WebSocket data:', data);
        document.getElementById('loading-spinner').style.display = 'none'; // Hide spinner after data is received

        if (data.error) {
            showError(data.error);
            if (data.error.includes('No user found for comparison')) {
                document.getElementById('user2_username').value = ''; // Clear the textbox
            }
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
        console.log(`WebSocket closed for ${user1Username}`);
        // Only show error if data hasn’t been received yet
        if (!lastData) {
            showError('WebSocket connection lost. Please refresh the page.');
        }
    };

    ws.onerror = function (error) {
        console.error('WebSocket error:', error);
        showError('An error occurred. Please try again later.');
    };

    return ws;
}