// static/js/theme.js
document.addEventListener('DOMContentLoaded', function() {
    const toggleSwitch = document.querySelector('.switch input[type="checkbox"]');
    const switchElement = document.querySelector('.switch');
    const currentTheme = localStorage.getItem('theme') || 'light';

    // Apply saved theme on page load
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
        switchElement.classList.add('on');
        toggleSwitch.checked = true;
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        switchElement.classList.remove('on');
    }

    // Toggle theme on switch change
    toggleSwitch.addEventListener('change', function() {
        if (this.checked) {
            document.documentElement.setAttribute('data-theme', 'light');
            switchElement.classList.add('on');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            switchElement.classList.remove('on');
            localStorage.setItem('theme', 'light');
        }
    });
});