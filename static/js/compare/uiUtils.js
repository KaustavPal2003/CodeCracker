// uiUtils.js
function showNotification(message) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => notification.style.display = 'none', 3000);
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (!errorDiv) return;
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function animateStats() {
    const stats = [
        'codeforces-rating',
        'leetcode-solved',
        'codechef-rating',
        'compare-codeforces-rating',
        'compare-leetcode-solved',
        'compare-codechef-rating'
    ];
    stats.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('updated');
            setTimeout(() => el.classList.remove('updated'), 1000);
        }
    });
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}