//codecracker\static\js\compare\main.js
import { updateStats, updateHistoryTable } from './statsUtils.js';
import { updateChart, renderPlatformToggles } from '../common/chartUtils.js';
import { initWebSocket, sendWebSocketMessage } from './websocket.js';

let user1Username = null;
let user2Username = null;
const statusCache = new Map();
const lastDataRef = { current: null };
let pendingComparison = null;

document.addEventListener('DOMContentLoaded', function () {
    const requiredElements = [
        'username-data', 'compare-form', 'compare-button', 'refresh-button',
        'reset-button', 'user1_username', 'user2_username', 'status-text',
        'loading-spinner', 'stats-container', 'chart-container', 'history-section',
        'notification', 'error-message'
    ];

    for (const id of requiredElements) {
        if (!document.getElementById(id)) {
            console.error(`Required element #${id} not found`);
            showError(`Page setup error: missing element #${id}`);
            return;
        }
    }

    console.log('Script loaded successfully');
    console.log('Moment available:', typeof moment !== 'undefined' ? 'Yes' : 'No');
    console.log('Chart.js version:', Chart.version);
    console.log('Pako available:', typeof pako !== 'undefined' ? 'Yes' : 'No');

    const loggedInUsername = document.getElementById('username-data').dataset.username;
    user1Username = loggedInUsername;
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]');

    if (!csrfToken) {
        console.error('CSRF token not found');
        showError('Security token missing. Please refresh the page.');
        return;
    }

    const compareForm = document.getElementById('compare-form');
    const compareButton = document.getElementById('compare-button');
    const refreshButton = document.getElementById('refresh-button');
    const resetButton = document.getElementById('reset-button');
    const user1Input = document.getElementById('user1_username');
    const user2Input = document.getElementById('user2_username');
    const statusText = document.getElementById('status-text');

    if (loggedInUsername) {
        initWebSocket(loggedInUsername);
    }

    checkUserStatus(loggedInUsername)
        .then(data => {
            if (!data.exists_in_sqlite) {
                statusText.textContent = "Invalid user";
                user1Input.value = '';
            } else if (!data.exists_in_mongodb || !data.has_valid_ratings) {
                statusText.textContent = "Enter two distinct valid usernames";
                user1Input.value = '';
            } else {
                statusText.textContent = "Enter another username in User 2:, you can change User 1: also";
                user1Input.value = loggedInUsername;
            }
        })
        .catch(error => {
            console.error('Error checking user status:', error);
            statusText.textContent = "Enter two distinct valid usernames";
            user1Input.value = '';
        });

    const debouncedUpdateCompareButton = debounce(updateCompareButton, 300);
    user1Input.addEventListener('input', debouncedUpdateCompareButton);
    user2Input.addEventListener('input', debouncedUpdateCompareButton);
    user1Input.addEventListener('input', () => fetchUsernameSuggestions(user1Input.value));
    user2Input.addEventListener('input', () => fetchUsernameSuggestions(user2Input.value));

    function updateCompareButton() {
        const user1 = sanitizeInput(user1Input.value.trim());
        const user2 = sanitizeInput(user2Input.value.trim());

        if (!user1 || !user2) {
            compareButton.disabled = true;
            compareButton.title = 'Enter two distinct valid usernames to compare';
            statusText.textContent = "Enter two distinct valid usernames";
            return;
        }
        if (user1 === user2) {
            compareButton.disabled = true;
            compareButton.title = 'Cannot compare the same username';
            statusText.textContent = "Cannot compare the same username";
            showNotification('Cannot compare the same username', 'error');
            return;
        }

        Promise.all([checkUserStatus(user1), checkUserStatus(user2)])
            .then(([user1Data, user2Data]) => {
                if (!user1Data.exists_in_sqlite) {
                    compareButton.disabled = true;
                    compareButton.title = 'Invalid user';
                    statusText.textContent = `Invalid user: ${user1}`;
                } else if (!user2Data.exists_in_sqlite) {
                    compareButton.disabled = true;
                    compareButton.title = 'Invalid user';
                    statusText.textContent = `Invalid user: ${user2}`;
                } else if (!user1Data.exists_in_mongodb || !user1Data.has_valid_ratings ||
                           !user2Data.exists_in_mongodb || !user2Data.has_valid_ratings) {
                    compareButton.disabled = true;
                    compareButton.title = 'One or both users have no ratings or history';
                    statusText.textContent = "One or both users have no ratings or history";
                } else {
                    compareButton.disabled = false;
                    compareButton.title = 'Click to compare users';
                    statusText.textContent = "Ready to compare";
                }
            })
            .catch(() => {
                compareButton.disabled = true;
                compareButton.title = 'Error validating usernames';
                statusText.textContent = "Error validating usernames";
            });
    }

    compareForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const newUser1Username = sanitizeInput(user1Input.value.trim());
        user2Username = sanitizeInput(user2Input.value.trim());

        if (!newUser1Username || !user2Username) {
            showError('Please enter both usernames');
            return;
        }

        if (newUser1Username === user2Username) {
            showError('Cannot compare the same username');
            return;
        }

        try {
            const [user1Data, user2Data] = await Promise.all([
                checkUserStatus(newUser1Username),
                checkUserStatus(user2Username)
            ]);

            if (!user1Data.exists_in_sqlite || !user2Data.exists_in_sqlite) {
                showError(`Invalid user: ${!user1Data.exists_in_sqlite ? newUser1Username : user2Username}`);
                return;
            }
            if (!user1Data.exists_in_mongodb || !user1Data.has_valid_ratings ||
                !user2Data.exists_in_mongodb || !user2Data.has_valid_ratings) {
                showError("One or both users have no ratings or history");
                return;
            }

            user1Username = newUser1Username;
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.style.display = 'block';

            try {
                pendingComparison = { compare_to: user2Username };
                await sendWebSocketMessage(pendingComparison);
                pendingComparison = null;
            } catch (wsError) {
                console.warn('WebSocket failed, falling back to HTTP:', wsError);
                pendingComparison = null;
                const response = await fetch('/compare_stats/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken.value
                    },
                    body: JSON.stringify({ user1_username: user1Username, user2_username: user2Username })
                });

                if (!response.ok) {
                    throw new Error(`HTTP request failed with status: ${response.status}`);
                }

                const data = await response.json();
                if (!data) throw new Error('Empty response data');

                lastDataRef.current = data;
                updateStats('user1', data.user1);
                updateStats('user2', data.compare_to); // Explicitly update user2
                updateHistoryTable(data.user1, data.compare_to);
                updateChart(data.user1, data.compare_to, user1Username, user2Username);
                const statsContainer = document.getElementById('stats-container');
                const chartContainer = document.getElementById('chart-container');
                const historySection = document.getElementById('history-section');
                if (statsContainer) statsContainer.style.display = 'block';
                if (chartContainer) chartContainer.style.display = 'block';
                if (historySection) historySection.style.display = 'block';
            } finally {
                if (spinner) spinner.style.display = 'none';
            }
        } catch (error) {
            console.error('Submission error:', error);
            showError(`Failed to compare users: ${error.message}`);
            if (spinner) spinner.style.display = 'none';
        }
    });

    refreshButton.addEventListener('click', async function () {
        if (user1Username && user2Username) {
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.style.display = 'block';
            try {
                pendingComparison = { compare_to: user2Username, force_refresh: true };
                await sendWebSocketMessage(pendingComparison);
                pendingComparison = null;
            } catch (error) {
                showNotification('Failed to refresh data', 'error');
            } finally {
                if (spinner) spinner.style.display = 'none';
            }
        } else {
            showNotification('Please select users to refresh', 'warning');
        }
    });

    resetButton.addEventListener('click', function () {
        user1Input.value = loggedInUsername;
        user2Input.value = '';
        user1Username = loggedInUsername;
        user2Username = null;
        pendingComparison = null;
        lastDataRef.current = null;
        if (window.chart) {
            window.chart.destroy();
            window.chart = null;
        }
        compareButton.disabled = true;
        compareButton.title = 'Enter two distinct valid usernames to compare';
        const spinner = document.getElementById('loading-spinner');
        const statsContainer = document.getElementById('stats-container');
        const chartContainer = document.getElementById('chart-container');
        const historySection = document.getElementById('history-section');
        const notification = document.getElementById('notification');
        const errorMessage = document.getElementById('error-message');
        if (spinner) spinner.style.display = 'none';
        if (statsContainer) statsContainer.style.display = 'none';
        if (chartContainer) chartContainer.style.display = 'none';
        if (historySection) historySection.style.display = 'none';
        if (notification) notification.style.display = 'none';
        if (errorMessage) errorMessage.style.display = 'none';
        checkUserStatus(loggedInUsername)
            .then(data => {
                if (!data.exists_in_sqlite) {
                    statusText.textContent = "Invalid user";
                } else if (!data.exists_in_mongodb || !data.has_valid_ratings) {
                    statusText.textContent = "Enter two distinct valid usernames";
                } else {
                    statusText.textContent = "Enter another username in User 2:, you can change User 1: also";
                }
            });
    });

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' &&
                (mutation.oldValue?.includes('dark-theme') !== document.body.classList.contains('dark-theme')) &&
                lastDataRef.current && window.chart) {
                updateChartColors(window.chart);
            }
        });
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
});

async function checkUserStatus(username, retries = 2) {
    if (typeof username !== 'string' || !username.length) {
        throw new Error('Invalid username parameter');
    }

    if (statusCache.has(username)) {
        return statusCache.get(username);
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(`/check_status/${encodeURIComponent(username)}/`);
            if (!response.ok) throw new Error(`Failed to fetch status: ${response.status}`);
            const data = await response.json();

            if (typeof data.exists_in_sqlite === 'undefined' ||
                typeof data.exists_in_mongodb === 'undefined' ||
                typeof data.has_valid_ratings === 'undefined') {
                throw new Error('Invalid response structure');
            }

            statusCache.set(username, data);
            setTimeout(() => statusCache.delete(username), 60000);
            return data;
        } catch (error) {
            if (attempt === retries) {
                console.error(`Error checking status for ${username} after ${retries + 1} attempts:`, error);
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
    }
}

function fetchUsernameSuggestions(query) {
    const sanitizedQuery = sanitizeInput(query);
    if (!sanitizedQuery) {
        const datalist = document.getElementById('username-suggestions');
        if (datalist) datalist.innerHTML = '';
        return;
    }
    fetch(`/api/suggestions/?q=${encodeURIComponent(sanitizedQuery)}`)
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch suggestions`);
            return response.json();
        })
        .then(data => {
            const datalist = document.getElementById('username-suggestions');
            if (datalist) {
                datalist.innerHTML = data.suggestions.map(username => `<option value="${username}">`).join('');
            }
        })
        .catch(error => console.error('Error fetching suggestions:', error));
}

function updateChartColors(chart) {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    chart.options.scales.x.ticks.color = isDarkTheme ? '#ffffff' : '#000000';
    chart.options.scales.y.ticks.color = isDarkTheme ? '#ffffff' : '#000000';
    chart.update();
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';
        setTimeout(() => notification.style.display = 'none', 3000);
    }
}

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => errorMessage.style.display = 'none', 3000);
    }
}

function sanitizeInput(input) {
    return input.replace(/[<>&;]/g, '');
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

window.addEventListener('error', function (event) {
    console.error('Global error:', event.error);
    showError('An unexpected error occurred. Please try again.');
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'none';
});

export { showError, showNotification, debounce };