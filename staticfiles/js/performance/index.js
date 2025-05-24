const username = document.getElementById("username-data").dataset.username;
const fetchUrl = document.getElementById("fetch-url").dataset.url;
const wsUrl = `ws://${window.location.host}/ws/performance/${username}/`;
let lastData = null;
let chart = null;
let isInitialLoadComplete = false;

// Set initial state
document.getElementById('loading-spinner').style.display = 'block';
const chartCanvas = document.getElementById('ratingChart');
if (chartCanvas) {
    chartCanvas.style.display = 'none';
} else {
    console.error("Chart canvas element not found!");
}

// Initialize WebSocket
const ws = initWebSocket(wsUrl, lastData, updateChart, updateHistory, () => {
    isInitialLoadComplete = true;
    document.getElementById('loading-spinner').style.display = 'none';
});

// Fetch initial data
fetch(fetchUrl)
    .then(response => response.json())
    .then(data => {
        console.log("Initial data fetched:", data);
        lastData = data;
        console.log("Updating chart with fetched data...");
        updateChart(data);
        updateHistory(data);
        isInitialLoadComplete = true;
        document.getElementById('loading-spinner').style.display = 'none';
    })
    .catch(error => {
        console.error("Error fetching initial data:", error);
        showNotification("Failed to load performance data.");
        document.getElementById('loading-spinner').style.display = 'none';
    });

// Theme Change Observer
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class' && lastData) {
            console.log("Theme changed detected");
            if (chart) {
                updateChartColors(chart);
                updateHistory(lastData); // History might need theme updates too
            }
        }
    });
});
observer.observe(document.body, { attributes: true });