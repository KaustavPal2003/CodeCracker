// static/js/common/utils.js

export function showError(message, timeout = 5000) {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        if (timeout > 0) {
            setTimeout(() => {
                errorMessage.style.display = 'none';
            }, timeout);
        }
    }
}

export function showNotification(message, type = 'info', timeout = 3000) {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.className = `notification notification-${type}`;
        notification.style.display = 'block';
        if (timeout > 0) {
            setTimeout(() => {
                notification.style.display = 'none';
            }, timeout);
        }
    }
}

export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

export function escapeHTML(str) {
    if (typeof str !== 'string') return str || '';
    return str.replace(/[&<>"'\/]/g, match => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;'
    })[match]);
}