// main.js
let lastData = null;
let user1Username = null;
let user2Username = null;
let ws = null;

document.addEventListener('DOMContentLoaded', function () {
    console.log('Script loaded successfully');
    console.log('Moment available:', typeof moment !== 'undefined' ? 'Yes' : 'No');
    console.log('Chart.js version:', Chart.version);
    console.log('Adapter registered:', typeof Chart._adapters !== 'undefined' && typeof Chart._adapters._date !== 'undefined' ? 'Yes' : 'No');

    const loggedInUsername = document.getElementById('username-data').dataset.username;
    user1Username = loggedInUsername;
    const fetchUrl = document.getElementById('fetch-url').dataset.url;

    let wsUrl = `ws://${window.location.host}/ws/stats/${loggedInUsername}/`;
    ws = initWebSocket(wsUrl, loggedInUsername, () => user2Username, window.chart, updateStats, updateChart);

    document.getElementById('compare-form').addEventListener('submit', function (event) {
        event.preventDefault();

        const newUser1Username = document.getElementById('user1_username').value.trim();
        user2Username = document.getElementById('user2_username').value.trim();

        console.log('Form submitted with:', { user1Username: newUser1Username, user2Username });

        if (newUser1Username && user2Username) {
            if (newUser1Username !== user1Username) {
                user1Username = newUser1Username;
                if (ws) {
                    ws.close();
                }
                wsUrl = `ws://${window.location.host}/ws/stats/${user1Username}/`;
                ws = initWebSocket(wsUrl, user1Username, () => user2Username, window.chart, updateStats, updateChart);
            }

            document.getElementById('loading-spinner').style.display = 'block';
            document.getElementById('stats-container').style.display = 'block';
            document.getElementById('chart-container').style.display = 'block';
            document.getElementById('history-section').style.display = 'block';

            const sendMessage = () => {
                if (ws.readyState === WebSocket.OPEN) {
                    sendCompareMessage(ws, user1Username, user2Username);
                } else {
                    ws.onopen = function () {
                        sendCompareMessage(ws, user1Username, user2Username);
                    };
                    ws.onerror = function (error) {
                        console.error('WebSocket error during connection:', error);
                        showError('Failed to connect to WebSocket. Please try again.');
                    };
                }
            };

            if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
                ws.onopen = function () {
                    sendCompareMessage(ws, user1Username, user2Username);
                };
            } else {
                sendMessage();
            }
        } else {
            showError('Please enter both usernames');
        }
    });

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' && lastData && window.chart) {
                window.chart.destroy();
                updateChart(lastData, user1Username, user2Username);
            }
        });
    });
    observer.observe(document.body, { attributes: true, attributeOldValue: true });
});

function sendCompareMessage(ws, user1Username, user2Username) {
    console.log('Sending WebSocket message:', { user1: user1Username, compare_to: user2Username });
    ws.send(JSON.stringify({
        user1: user1Username,
        compare_to: user2Username
    }));
}