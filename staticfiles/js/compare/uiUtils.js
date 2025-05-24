// static/js/compare/uiUtils.js
function animateStats() {
    const statContainers = [
        document.getElementById('user1-stats'),
        document.getElementById('compare-section')
    ].filter(Boolean);

    if (statContainers.length === 0) {
        console.warn('No stat containers found for animation');
        return;
    }

    statContainers.forEach(container => {
        const statElements = container.querySelectorAll('.stat-value');
        statElements.forEach(el => {
            el.classList.add('updated');
            setTimeout(() => el.classList.remove('updated'), 1000);
        });
    });
}

export { animateStats };