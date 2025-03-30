function initWebSocket(wsUrl, lastData, updateChart, updateHistory, onInitialLoad) {
    const ws = new WebSocket(wsUrl);

    ws.onopen = function () {
        console.log(`WebSocket connected for ${username}`);
    };

    ws.onmessage = debounce(function (event) {
        const data = JSON.parse(event.data);
        console.log("Received WebSocket data:", data);

        if (data.error) {
            console.error("WebSocket error:", data.error);
            showNotification("Error: " + data.error);
            return;
        }

        if (lastData && JSON.stringify(data) !== JSON.stringify(lastData)) {
            showNotification("Data updated!");
        }
        lastData = data;

        console.log("Updating chart with WebSocket data...");
        updateChart(data);
        updateHistory(data);
        onInitialLoad();
    }, 1000);

    ws.onclose = function () {
        console.log(`WebSocket disconnected for ${username}`);
        showNotification("Connection lost. Updates paused.");
    };

    ws.onerror = function (error) {
        console.error("WebSocket error:", error);
        showNotification("WebSocket error occurred.");
    };

    return ws;
}