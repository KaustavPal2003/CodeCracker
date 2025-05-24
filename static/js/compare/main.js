// codecracker/static/js/compare/main.js
import { updateStats, updateHistoryTable } from '../common/statsUtils.js';
import { updateChart } from '../common/chartUtils.js';
import { initWebSocket, sendWebSocketMessage } from '../common/websocket.js';
import { showError, showNotification, debounce } from '../common/utils.js';

const CONSTANTS = {
    CACHE_TIMEOUT: 120000,
    NOTIFICATION_TIMEOUT: 3000,
    DEBOUNCE_WAIT: 300,
    MAX_USERNAME_LENGTH: 50,
    MIN_USERNAME_LENGTH: 3,
};

const checkDependencies = () => {
    const dependencies = {
        moment: typeof moment !== 'undefined',
        Chart: typeof Chart !== 'undefined',
        pako: typeof pako !== 'undefined',
    };
    if (!dependencies.moment || !dependencies.Chart) {
        console.error('Critical dependency missing');
        showError('Missing critical dependency (moment or Chart). Please refresh the page.');
        return false;
    }
    if (!dependencies.pako) {
        console.warn('Pako not available; WebSocket compression may not work');
    }
    console.log('Moment available:', dependencies.moment ? 'Yes' : 'No');
    console.log('Chart.js version:', dependencies.Chart ? Chart.version : 'Not loaded');
    console.log('Pako available:', dependencies.pako ? 'Yes' : 'No');
    return true;
};

class CompareManager {
    constructor() {
        this.user1Username = null;
        this.user2Username = null;
        this.statusCache = new Map();
        this.lastDataRef = { current: null };
        this.pendingComparison = null;
        this.isComparing = false;
        this.chartInstance = null;
        this.wsInstance = null;
        this.elements = this.cacheElements();
    }

    cacheElements() {
        const ids = [
            'username-data', 'compare-form', 'compare-button', 'refresh-button',
            'reset-button', 'user1_username', 'user2_username', 'status-text',
            'loading-spinner', 'stats-container', 'chart-container', 'history-section',
            'notification', 'error-message', 'user1-error', 'user2-error'
        ];
        const elements = {};
        for (const id of ids) {
            elements[id] = document.getElementById(id);
            if (!elements[id]) {
                console.error(`Required element #${id} not found`);
                showError(`Page setup error: missing element #${id}`);
                return null;
            }
        }
        return elements;
    }

    initialize() {
        if (!this.elements || !checkDependencies()) return;

        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]');
        if (!csrfToken) {
            console.error('CSRF token not found');
            showError('Security token missing. Please refresh the page.');
            return;
        }

        this.user1Username = this.elements['username-data'].dataset.username;
        if (this.user1Username) {
            this.wsInstance = initWebSocket(this.user1Username, 'compare', {
                updateStats,
                updateHistoryTable,
                updateChart: (user1Data, compareData, user1Username, user2Username, mode) => {
                    if (this.chartInstance) {
                        this.chartInstance.cleanup();
                        console.log('Cleaned up existing chart instance in WebSocket update');
                    }
                    this.chartInstance = updateChart(user1Data, compareData, user1Username, user2Username, mode);
                    return this.chartInstance;
                }
            });
            this.checkInitialUserStatus();
        }

        this.setupEventListeners();

        window.addEventListener('beforeunload', () => this.cleanup());
    }

    cleanup() {
        console.log('Cleaning up CompareManager resources');
        if (this.chartInstance) {
            this.chartInstance.cleanup();
            this.chartInstance = null;
            console.log('Destroyed chart instance in cleanup');
        }
        if (this.wsInstance?.close) {
            this.wsInstance.close();
            this.wsInstance = null;
            console.log('Closed WebSocket connection in cleanup');
        }
    }

    checkInitialUserStatus() {
        checkUserStatus(this.user1Username)
            .then(data => {
                this.elements['status-text'].textContent = this.getStatusText(data);
                this.elements['user1_username'].value = data.exists_in_sqlite ? this.user1Username : '';
                this.elements['user1-error'].textContent = data.exists_in_sqlite ? '' : 'Invalid username';
                this.elements['user1-error'].style.display = data.exists_in_sqlite ? 'none' : 'block';
            })
            .catch(error => {
                console.error('Error checking user status:', error);
                this.elements['status-text'].textContent = "Enter two distinct valid usernames";
                this.elements['user1_username'].value = '';
                this.elements['user1-error'].textContent = 'Error validating username';
                this.elements['user1-error'].style.display = 'block';
            });
    }

    getStatusText(data) {
        if (!data.exists_in_sqlite) return "Invalid user";
        if (!data.exists_in_mongodb || !data.has_valid_ratings) return "Enter two distinct valid usernames";
        return "Enter another username in User 2:, you can change User 1: also";
    }

    setupEventListeners() {
        const debouncedUpdateCompareButton = debounce(this.updateCompareButton.bind(this), CONSTANTS.DEBOUNCE_WAIT);
        this.elements['user1_username'].addEventListener('input', debouncedUpdateCompareButton);
        this.elements['user2_username'].addEventListener('input', debouncedUpdateCompareButton);
        this.elements['user1_username'].addEventListener('input', () => fetchUsernameSuggestions(this.elements['user1_username'].value));
        this.elements['user2_username'].addEventListener('input', () => fetchUsernameSuggestions(this.elements['user2_username'].value));
        this.elements['compare-form'].addEventListener('submit', this.handleSubmit.bind(this));
        this.elements['refresh-button'].addEventListener('click', this.handleRefresh.bind(this));
        this.elements['reset-button'].addEventListener('click', this.handleReset.bind(this));
    }

    async updateCompareButton() {
        const user1 = sanitizeInput(this.elements['user1_username'].value.trim());
        const user2 = sanitizeInput(this.elements['user2_username'].value.trim());

        this.elements['user1-error'].style.display = 'none';
        this.elements['user2-error'].style.display = 'none';

        if (!user1 || !user2 || user1 === user2 || !this.isValidUsername(user1) || !this.isValidUsername(user2)) {
            this.elements['compare-button'].disabled = true;
            this.elements['compare-button'].title = this.getButtonTitle(user1, user2);
            this.elements['status-text'].textContent = this.getStatusTextForCompare(user1, user2);
            if (user1 === user2) {
                showNotification('Cannot compare the same username', 'error', CONSTANTS.NOTIFICATION_TIMEOUT);
                this.elements['user2-error'].textContent = 'Cannot compare the same username';
                this.elements['user2-error'].style.display = 'block';
            } else if (!this.isValidUsername(user1)) {
                this.elements['user1-error'].textContent = 'Invalid username format';
                this.elements['user1-error'].style.display = 'block';
            } else if (!this.isValidUsername(user2)) {
                this.elements['user2-error'].textContent = 'Invalid username format';
                this.elements['user2-error'].style.display = 'block';
            }
            return;
        }

        try {
            const [user1Data, user2Data] = await Promise.all([checkUserStatus(user1), checkUserStatus(user2)]);
            const isValid = user1Data.exists_in_sqlite && user2Data.exists_in_sqlite &&
                           user1Data.exists_in_mongodb && user1Data.has_valid_ratings &&
                           user2Data.exists_in_mongodb && user2Data.has_valid_ratings;
            this.elements['compare-button'].disabled = !isValid;
            this.elements['compare-button'].title = isValid ? 'Click to compare users' : 'One or both users have no ratings or history';
            this.elements['status-text'].textContent = isValid ? 'Ready to compare' : this.getStatusTextForCompare(user1, user2, user1Data, user2Data);
            if (!user1Data.exists_in_sqlite) {
                this.elements['user1-error'].textContent = 'User not found';
                this.elements['user1-error'].style.display = 'block';
            }
            if (!user2Data.exists_in_sqlite) {
                this.elements['user2-error'].textContent = 'User not found';
                this.elements['user2-error'].style.display = 'block';
            }
            if (!user1Data.exists_in_mongodb || !user1Data.has_valid_ratings) {
                this.elements['user1-error'].textContent = 'No ratings or history for this user';
                this.elements['user1-error'].style.display = 'block';
            }
            if (!user2Data.exists_in_mongodb || !user2Data.has_valid_ratings) {
                this.elements['user2-error'].textContent = 'No ratings or history for this user';
                this.elements['user2-error'].style.display = 'block';
            }
        } catch {
            this.elements['compare-button'].disabled = true;
            this.elements['compare-button'].title = 'Error validating usernames';
            this.elements['status-text'].textContent = 'Error validating usernames';
            this.elements['user1-error'].textContent = 'Error validating username';
            this.elements['user2-error'].textContent = 'Error validating username';
            this.elements['user1-error'].style.display = 'block';
            this.elements['user2-error'].style.display = 'block';
        }
    }

    getButtonTitle(user1, user2) {
        if (!user1 || !user2) return 'Enter two distinct valid usernames to compare';
        if (user1 === user2) return 'Cannot compare the same username';
        return 'Invalid usernames';
    }

    getStatusTextForCompare(user1, user2, user1Data = {}, user2Data = {}) {
        if (!user1 || !user2) return 'Enter two distinct valid usernames';
        if (user1 === user2) return 'Cannot compare the same username';
        if (!user1Data.exists_in_sqlite) return `Invalid user: ${user1}`;
        if (!user2Data.exists_in_sqlite) return `Invalid user: ${user2}`;
        if (!user1Data.exists_in_mongodb || !user1Data.has_valid_ratings ||
            !user2Data.exists_in_mongodb || !user2Data.has_valid_ratings) {
            return 'One or both users have no ratings or history';
        }
        return 'Error validating usernames';
    }

    async handleSubmit(event) {
        event.preventDefault();
        if (this.isComparing) return;

        const newUser1Username = sanitizeInput(this.elements['user1_username'].value.trim());
        this.user2Username = sanitizeInput(this.elements['user2_username'].value.trim());

        this.elements['user1-error'].style.display = 'none';
        this.elements['user2-error'].style.display = 'none';

        if (!newUser1Username || !this.user2Username || newUser1Username === this.user2Username || !this.isValidUsername(newUser1Username) || !this.isValidUsername(this.user2Username)) {
            showError(newUser1Username === this.user2Username ? 'Cannot compare the same username' : 'Please enter valid usernames', CONSTANTS.NOTIFICATION_TIMEOUT);
            if (newUser1Username === this.user2Username) {
                this.elements['user2-error'].textContent = 'Cannot compare the same username';
                this.elements['user2-error'].style.display = 'block';
            } else {
                if (!this.isValidUsername(newUser1Username)) {
                    this.elements['user1-error'].textContent = 'Invalid username format';
                    this.elements['user1-error'].style.display = 'block';
                }
                if (!this.isValidUsername(this.user2Username)) {
                    this.elements['user2-error'].textContent = 'Invalid username format';
                    this.elements['user2-error'].style.display = 'block';
                }
            }
            return;
        }

        try {
            const [user1Data, user2Data] = await Promise.all([checkUserStatus(newUser1Username), checkUserStatus(this.user2Username)]);
            if (!user1Data.exists_in_sqlite || !user2Data.exists_in_sqlite || !user1Data.exists_in_mongodb || !user1Data.has_valid_ratings || !user2Data.exists_in_mongodb || !user2Data.has_valid_ratings) {
                showError(this.getStatusTextForCompare(newUser1Username, this.user2Username, user1Data, user2Data), CONSTANTS.NOTIFICATION_TIMEOUT);
                if (!user1Data.exists_in_sqlite) {
                    this.elements['user1-error'].textContent = 'User not found';
                    this.elements['user1-error'].style.display = 'block';
                }
                if (!user2Data.exists_in_sqlite) {
                    this.elements['user2-error'].textContent = 'User not found';
                    this.elements['user2-error'].style.display = 'block';
                }
                if (!user1Data.exists_in_mongodb || !user1Data.has_valid_ratings) {
                    this.elements['user1-error'].textContent = 'No ratings or history for this user';
                    this.elements['user1-error'].style.display = 'block';
                }
                if (!user2Data.exists_in_mongodb || !user2Data.has_valid_ratings) {
                    this.elements['user2-error'].textContent = 'No ratings or history for this user';
                    this.elements['user2-error'].style.display = 'block';
                }
                return;
            }

            this.user1Username = newUser1Username;
            this.isComparing = true;
            this.elements['loading-spinner'].style.display = 'block';

            try {
                this.pendingComparison = { compare_to: this.user2Username };
                await sendWebSocketMessage(this.pendingComparison, 'compare');
                this.pendingComparison = null;
            } catch (wsError) {
                console.warn('WebSocket failed, falling back to HTTP:', wsError);
                const response = await fetch('/compare_stats/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
                    },
                    body: JSON.stringify({ user1_username: this.user1Username, user2_username: this.user2Username }),
                });

                if (!response.ok) {
                    if (response.status === 403) {
                        throw new Error('Session expired. Please refresh the page and log in again.');
                    }
                    throw new Error(`HTTP request failed with status: ${response.status}`);
                }
                const data = await response.json();
                if (!data) throw new Error('Empty response data');
                this.handleComparisonResponse(data);
            }
        } catch (error) {
            console.error('Submission error:', error);
            showError(`Failed to compare users: ${error.message}`, CONSTANTS.NOTIFICATION_TIMEOUT);
            this.elements['user1-error'].textContent = `Comparison failed: ${error.message}`;
            this.elements['user2-error'].textContent = `Comparison failed: ${error.message}`;
            this.elements['user1-error'].style.display = 'block';
            this.elements['user2-error'].style.display = 'block';
        } finally {
            this.isComparing = false;
            this.elements['loading-spinner'].style.display = 'none';
        }
    }

    handleComparisonResponse(data) {
        this.lastDataRef.current = data;
        updateStats('user1', data.user1);
        updateStats('user2', data.compare_to);
        updateHistoryTable(data.user1, data.compare_to, 'compare');
        if (this.chartInstance) {
            this.chartInstance.cleanup();
            console.log('Cleaned up existing chart instance in handleComparisonResponse');
        }
        this.chartInstance = updateChart(data.user1, data.compare_to, this.user1Username, this.user2Username, 'compare');
        this.elements['stats-container'].style.display = 'block';
        this.elements['chart-container'].style.display = 'block';
        this.elements['history-section'].style.display = 'block';
    }

    async handleRefresh() {
        if (!this.user1Username || !this.user2Username) {
            showNotification('Please select users to refresh', 'warning', CONSTANTS.NOTIFICATION_TIMEOUT);
            return;
        }
        if (this.isComparing) return;

        this.isComparing = true;
        this.elements['loading-spinner'].style.display = 'block';
        try {
            this.pendingComparison = { compare_to: this.user2Username, force_refresh: true };
            await sendWebSocketMessage(this.pendingComparison, 'compare');
            this.pendingComparison = null;
        } catch (error) {
            showNotification('Failed to refresh data', 'error', CONSTANTS.NOTIFICATION_TIMEOUT);
        } finally {
            this.isComparing = false;
            this.elements['loading-spinner'].style.display = 'none';
        }
    }

    handleReset() {
        this.elements['user1_username'].value = this.elements['username-data'].dataset.username;
        this.elements['user2_username'].value = '';
        this.user1Username = this.elements['username-data'].dataset.username;
        this.user2Username = null;
        this.pendingComparison = null;
        this.lastDataRef.current = null;
        if (this.chartInstance) {
            this.chartInstance.cleanup();
            this.chartInstance = null;
            console.log('Cleaned up chart instance in handleReset');
        }
        this.elements['compare-button'].disabled = true;
        this.elements['compare-button'].title = 'Enter two distinct valid usernames to compare';
        ['loading-spinner', 'stats-container', 'chart-container', 'history-section', 'notification', 'error-message', 'user1-error', 'user2-error'].forEach(id => {
            this.elements[id].style.display = 'none';
        });
        this.checkInitialUserStatus();
    }

    isValidUsername(username) {
        const regex = /^[a-zA-Z0-9_-]+$/;
        return username.length >= CONSTANTS.MIN_USERNAME_LENGTH &&
               username.length <= CONSTANTS.MAX_USERNAME_LENGTH &&
               regex.test(username);
    }
}

function sanitizeInput(input) {
    const sanitized = input.replace(/[^a-zA-Z0-9_-]/g, '').trim();
    if (sanitized !== input) {
        showNotification('Invalid characters removed from username', 'warning', CONSTANTS.NOTIFICATION_TIMEOUT);
    }
    return sanitized;
}

async function checkUserStatus(username, retries = 1) {
    if (typeof username !== 'string' || !username.length) {
        throw new Error('Invalid username parameter');
    }

    const manager = compareManager.statusCache;
    if (manager.has(username)) {
        return manager.get(username);
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

            manager.set(username, data);
            setTimeout(() => manager.delete(username), CONSTANTS.CACHE_TIMEOUT);
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

const compareManager = new CompareManager();
document.addEventListener('DOMContentLoaded', () => compareManager.initialize());

window.addEventListener('error', function (event) {
    console.error('Global error:', event.error);
    showError('An unexpected error occurred. Please try again.', CONSTANTS.NOTIFICATION_TIMEOUT);
    compareManager.elements['loading-spinner'].style.display = 'none';
});