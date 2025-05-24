//E:\Best_project\codecracker\static\js\performance\chartUtils.js
function getChartColors() {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    return {
        text: isDarkTheme ? '#ffffff' : '#2c3e50',
        grid: isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
        background: isDarkTheme ? '#2d2d2d' : '#ffffff',
        platforms: {
            codeforces: '#3498db',
            codechef: '#e74c3c',
            leetcode: '#2ecc71'
        }
    };
}

function getChartElements() {
    return {
        ctx: document.getElementById('ratingChart')?.getContext('2d'),
        noDataMessage: document.getElementById('no-data-message-chart'),
        zoomToFit: document.getElementById('zoom-to-fit'),
        resetZoom: document.getElementById('reset-zoom')
    };
}

export function updateChartColors(chart) {
    if (!chart) return;
    const colors = getChartColors();

    chart.options.scales.x.ticks.color = colors.text;
    chart.options.scales.y.ticks.color = colors.text;
    chart.options.scales.x.grid.color = colors.grid;
    chart.options.scales.y.grid.color = colors.grid;
    chart.options.plugins.tooltip.backgroundColor = colors.background + 'cc';
    chart.options.plugins.tooltip.titleColor = colors.text;
    chart.options.plugins.tooltip.bodyColor = colors.text;
    chart.options.plugins.tooltip.borderColor = colors.text;
    chart.options.plugins.legend.labels.color = colors.text;
    chart.canvas.style.backgroundColor = colors.background;
    chart.update();
}

function processRatingData(ratingHistory, platform) {
    if (!Array.isArray(ratingHistory)) return [];
    return ratingHistory
        .filter(h => h?.platform?.toLowerCase() === platform.toLowerCase())
        .map(h => ({
            x: new Date(h.date).getTime(),
            y: h.new_rating || 0,
            contest: h.contest,
            rank: h.rank
        }))
        .filter(d => !isNaN(d.x) && !isNaN(d.y));
}

export function updateChart(userData, compareData, username, compareUsername) {
    const elements = getChartElements();
    if (!elements.ctx) {
        console.error('Chart canvas not found');
        return;
    }

    const colors = getChartColors();
    if (window.chart) window.chart.destroy();

    const platforms = ['Codeforces', 'CodeChef', 'LeetCode'];
    const datasets = platforms.map(platform => ({
        label: `${username} - ${platform}`,
        data: processRatingData(userData?.rating_history, platform),
        borderColor: colors.platforms[platform.toLowerCase()],
        backgroundColor: colors.platforms[platform.toLowerCase()] + '33',
        fill: false,
        tension: 0.1,
        pointRadius: 4,
        pointHoverRadius: 6
    }));

    const allDates = datasets.flatMap(ds => ds.data.map(d => d.x)).filter(d => d);
    const allRatings = datasets.flatMap(ds => ds.data.map(d => d.y)).filter(r => r);
    if (!allDates.length || !allRatings.length) {
        elements.noDataMessage.style.display = 'block';
        elements.zoomToFit.style.display = 'none';
        elements.resetZoom.style.display = 'none';
        return;
    }

    elements.noDataMessage.style.display = 'none';
    elements.zoomToFit.style.display = 'block';
    elements.resetZoom.style.display = 'block';

    const [minDate, maxDate] = [Math.min(...allDates), Math.max(...allDates)];
    const [minRating, maxRating] = [Math.min(...allRatings), Math.max(...allRatings)];
    const dateRange = maxDate - minDate || 1;
    const ratingRange = maxRating - minRating || 1;
    const padding = 0.2;
    const initialBounds = {
        x: { min: minDate - dateRange * padding, max: maxDate + dateRange * padding },
        y: { min: Math.max(0, minRating - ratingRange * padding), max: maxRating + ratingRange * padding }
    };

    window.chart = new Chart(elements.ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'month', displayFormats: { month: 'MMM YYYY' } },
                    title: { display: true, text: 'Date', color: colors.text },
                    ticks: { color: colors.text },
                    grid: { color: colors.grid },
                    min: initialBounds.x.min,
                    max: initialBounds.x.max
                },
                y: {
                    title: { display: true, text: 'Rating', color: colors.text },
                    ticks: { color: colors.text },
                    grid: { color: colors.grid },
                    min: initialBounds.y.min,
                    max: initialBounds.y.max
                }
            },
            plugins: {
                zoom: {
                    pan: { enabled: true, mode: 'xy' },
                    zoom: { wheel: { enabled: true }, mode: 'xy' }
                },
                legend: { labels: { color: colors.text } },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.raw.y} (Contest: ${ctx.raw.contest || 'N/A'}, Rank: ${ctx.raw.rank || 'N/A'})`
                    }
                }
            }
        }
    });

    elements.zoomToFit.addEventListener('click', () => {
        window.chart.resetZoom();
    });

    elements.resetZoom.addEventListener('click', () => {
        window.chart.resetZoom();
    });
}