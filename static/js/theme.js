// static/js/theme.js
document.addEventListener('DOMContentLoaded', function () {
    const checkbox = document.getElementById('checkbox');
    const themeLabel = document.getElementById('theme-label');
    const switchElement = document.querySelector('.switch');
    const currentTheme = localStorage.getItem('theme') || 'light';

    if (currentTheme === 'dark') {
        document.body.classList.add('dark-theme');
        checkbox.checked = true;
        switchElement.classList.add('on');
    } else {
        switchElement.classList.remove('on');
    }

    checkbox.addEventListener('change', function () {
        if (checkbox.checked) {
            document.body.classList.add('dark-theme');
            switchElement.classList.add('on');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            switchElement.classList.remove('on');
            localStorage.setItem('theme', 'light');
        }
    });
});