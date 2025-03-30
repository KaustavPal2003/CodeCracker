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

    const compareForm = document.getElementById('compare-form');
    const compareButton = document.getElementById('compare-button');
    const refreshButton = document.getElementById('refresh-button');
    const user1Input = document.getElementById('user1_username');
    const user2Input = document.getElementById('user2_username');

    // Check logged-in user's rating status on page load
    fetchUserStatus(loggedInUsername, (hasRatings) => {
        if (!hasRatings) {
            document.getElementById('no-rating-message').style.display = 'block';
        }
    });

    // Enable compare button if valid usernames are entered
    function updateCompareButton() {
        Promise.all([
            validateUser(user1Input.value.trim()),
            validateUser(user2Input.value.trim())
        ]).then(([user1Valid, user2Valid]) => {
            compareButton.disabled = !(user1Valid && user2Valid);
        });
    }

    user1Input.addEventListener('input', updateCompareButton);
    user2Input.addEventListener('input', updateCompareButton);

    compareForm.addEventListener('submit', function (event) {
        event.preventDefault();

        const newUser1Username = user1Input.value.trim();
        user2Username = user2Input.value.trim();

        console.log('Form submitted with:', { user1Username: newUser1Username, user2Username });

        if (!newUser1Username || !user2Username) {
            showError('Please enter both usernames');
            return;
        }

        Promise.all([
            validateUser(newUser1Username),
            validateUser(user2Username)
        ]).then(([user1Valid, user2Valid]) => {
            if (!user1Valid && !user2Valid) {
                showError('Both usernames are invalid');
            } else if (!user1Valid) {
                showError(`Invalid username: ${newUser1Username}`);
            } else if (!user2Valid) {
                showError(`Invalid username: ${user2Username}`);
            } else {
                user1Username = newUser1Username;
                if (ws && ws.readyState !== WebSocket.CLOSED) {
                    ws.close();
                }

                const wsUrl = `ws://${window.location.host}/ws/stats/${user1Username}/`;
                ws = initWebSocket(wsUrl, user1Username, () => user2Username, window.chart, updateStats, updateChart);

                document.getElementById('loading-spinner').style.display = 'block';
                document.getElementById('stats-container').style.display = 'block';
                document.getElementById('chart-container').style.display = 'block';
                document.getElementById('history-section').style.display = 'block';

                ws.onopen = function () {
                    sendCompareMessage(ws, user1Username, user2Username);
                };
                ws.onerror = function (error) {
                    console.error('WebSocket error:', error);
                    showError('Failed to connect to WebSocket. Please try again.');
                };
            }
        }).catch(error => {
            console.error('Validation error:', error);
            showError('An error occurred while validating usernames');
        });
    });

    refreshButton.addEventListener('click', function () {
        if (ws && ws.readyState === WebSocket.OPEN) {
            document.getElementById('loading-spinner').style.display = 'block';
            ws.send(JSON.stringify({
                user1: user1Username,
                compare_to: user2Username,
                force_refresh: true
            }));
        } else {
            showError('Please compare users first before refreshing');
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

function fetchUserStatus(username, callback) {
    const wsUrl = `ws://${window.location.host}/ws/stats/${username}/`;
    const tempWs = new WebSocket(wsUrl);
    tempWs.onmessage = function (event) {
        const data = JSON.parse(event.data);
        console.log('User status data:', data);
        const hasRatings = !data.has_no_ratings;
        callback(hasRatings);
        tempWs.close();
    };
    tempWs.onerror = function () {
        console.error('Error fetching user status');
        callback(false);
        tempWs.close();
    };
}

function validateUser(username) {
    return new Promise((resolve) => {
        const wsUrl = `ws://${window.location.host}/ws/stats/${username}/`;
        const tempWs = new WebSocket(wsUrl);
        tempWs.onmessage = function (event) {
            const data = JSON.parse(event.data);
            console.log('Validation data for', username, ':', data);
            resolve(!data.error || !data.error.includes('User stats not found'));
            tempWs.close();
        };
        tempWs.onerror = function () {
            resolve(false);
            tempWs.close();
        };
    });
}