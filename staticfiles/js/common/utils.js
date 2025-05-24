// static/js/common/utils.js
export function showNotification(message, type = 'info', timeout = 3000) {
    const notification = document.getElementById('notification');
    if (!notification) return;

    Object.assign(notification, {
        textContent: message,
        className: `notification ${type}`,
        style: { display: 'block' }
    });

    setTimeout(() => notification.style.display = 'none', timeout);
}

export function showError(message, timeout = 3000) {
    const errorMessage = document.getElementById('error-message');
    if (!errorMessage) return;

    Object.assign(errorMessage, {
        textContent: message,
        style: { display: 'block' }
    });

    setTimeout(() => errorMessage.style.display = 'none', timeout);
}

export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}