//E:\Best_project\codecracker\static\js\compare\chartUtils.js
// Define theme-based colors

function getChartColors() {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    return {
        text: isDarkTheme ? '#ffffff' : '#2c3e50',
        grid: isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
        background: isDarkTheme ? '#2d2d2d' : '#ffffff',
        platforms: {
            codeforces: { main: isDarkTheme ? '#87cefa' : '#3498db', compare: '#f1c40f' },
            codechef: { main: isDarkTheme ? '#ffa07a' : '#e74c3c', compare: '#9b59b6' },
            leetcode: { main: '#2ecc71', compare: '#e67e22' }
        }
    };
}

// Get DOM elements for the chart
function getChartElements() {
    return {
        ctx: document.getElementById('ratingChart')?.getContext('2d'),
        noDataMessage: document.getElementById('no-data-message-chart'),
        zoomToFit: document.getElementById('zoom-to-fit'),
        resetZoom: document.getElementById('reset-zoom')
    };
}

// Update chart colors based on theme
export function updateChartColors(chart) {
    if (!chart) return;
    const colors = getChartColors();

    const scales = chart.options.scales;
    ['x', 'y'].forEach(axis => {
        scales[axis].title.color = colors.text;
        scales[axis].ticks.color = colors.text;
        scales[axis].grid.color = colors.grid;
    });

    const { codeforces, codechef, leetcode } = colors.platforms;
    const datasets = chart.data.datasets;
    datasets[0].borderColor = codeforces.main;
    datasets[0].backgroundColor = codeforces.main + '33';
    datasets[1].borderColor = codechef.main;
    datasets[1].backgroundColor = codechef.main + '33';
    datasets[2].borderColor = leetcode.main;
    datasets[2].backgroundColor = leetcode.main + '33';
    datasets[3].borderColor = codeforces.compare;
    datasets[3].backgroundColor = codeforces.compare + '33';
    datasets[4].borderColor = codechef.compare;
    datasets[4].backgroundColor = codechef.compare + '33';
    datasets[5].borderColor = leetcode.compare;
    datasets[5].backgroundColor = leetcode.compare + '33';

    chart.options.plugins.tooltip = {
        backgroundColor: colors.background + 'cc',
        titleColor: colors.text,
        bodyColor: colors.text,
        borderColor: colors.text
    };
    chart.options.plugins.legend.labels.color = colors.text;
    chart.options.backgroundColor = colors.background;
    chart.canvas.style.backgroundColor = colors.background;

    chart.update('active');
}

// Process rating history into chart data
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

// Main chart update function
export function updateChart(user1Data, compareData, user1Username, user2Username) {
    const elements = getChartElements();
    if (!elements.ctx || !elements.noDataMessage || !elements.zoomToFit || !elements.resetZoom) {
        console.error('Missing required chart DOM elements');
        return;
    }

    const colors = getChartColors();
    if (window.chart) window.chart.destroy();

    const user2UsernameDisplay = compareData?.username || user2Username || 'Compare';
    const platforms = ['Codeforces', 'CodeChef', 'LeetCode'];
    const datasets = platforms.flatMap(platform => [
        {
            label: `${user1Username} - ${platform}`,
            data: processRatingData(user1Data?.rating_history, platform),
            borderColor: colors.platforms[platform.toLowerCase()].main,
            backgroundColor: colors.platforms[platform.toLowerCase()].main + '33'
        },
        {
            label: `${user2UsernameDisplay} - ${platform}`,
            data: processRatingData(compareData?.rating_history, platform),
            borderColor: colors.platforms[platform.toLowerCase()].compare,
            backgroundColor: colors.platforms[platform.toLowerCase()].compare + '33'
        }
    ]);

    const allDates = datasets.flatMap(ds => ds.data.map(d => d.x)).filter(d => d);
    const allRatings = datasets.flatMap(ds => ds.data.map(d => d.y)).filter(r => r);
    if (!allDates.length || !allRatings.length) {
        console.warn('No valid data points for chart');
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
        data: { datasets: datasets.map(ds => ({ ...ds, fill: false, tension: 0.1, pointRadius: 4, pointHoverRadius: 6 })) },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'month', displayFormats: { month: 'MMM YYYY' } },
                    title: { display: true, text: 'Date', color: colors.text, font: { size: 16, weight: 'bold' } },
                    ticks: { color: colors.text, font: { size: 14 } },
                    grid: { color: colors.grid },
                    min: initialBounds.x.min,
                    max: initialBounds.x.max
                },
                y: {
                    title: { display: true, text: 'Rating', color: colors.text, font: { size: 16, weight: 'bold' } },
                    ticks: { color: colors.text, font: { size: 14 } },
                    grid: { color: colors.grid },
                    min: initialBounds.y.min,
                    max: initialBounds.y.max
                }
            },
            plugins: {
                zoom: {
                    pan: { enabled: true, mode: 'xy', speed: 20, threshold: 0 },
                    zoom: { wheel: { enabled: true, speed: 0.1 }, mode: 'xy' },
                    limits: {
                        x: { min: minDate - dateRange * padding * 2, max: maxDate + dateRange * padding * 2, minRange: dateRange / 10 },
                        y: { min: Math.max(0, minRating - ratingRange * padding * 2), max: maxRating + ratingRange * padding * 2, minRange: ratingRange / 10 }
                    }
                },
                legend: {
                    labels: { color: colors.text, font: { size: 14 }, usePointStyle: true },
                    onClick: (e, item, legend) => {
                        const index = item.datasetIndex;
                        const meta = legend.chart.getDatasetMeta(index);
                        meta.hidden = !meta.hidden;
                        legend.chart.update();
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: colors.background + 'cc',
                    titleColor: colors.text,
                    bodyColor: colors.text,
                    borderColor: colors.text,
                    borderWidth: 1,
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.raw.y} (Contest: ${ctx.raw.contest || 'N/A'}, Rank: ${ctx.raw.rank || 'N/A'})`
                    }
                }
            },
            backgroundColor: colors.background,
            animation: { duration: 1000, easing: 'easeOutQuart' },
            onClick: (event, elements) => {
                if (elements.length) {
                    const { datasetIndex, index } = elements[0];
                    const point = window.chart.data.datasets[datasetIndex].data[index];
                    alert(`Contest: ${point.contest || 'N/A'}\nRank: ${point.rank || 'N/A'}\nRating: ${point.y}`);
                }
            }
        }
    });

    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    const canvas = window.chart.canvas;
    canvas.style.cursor = 'grab';

    canvas.addEventListener('mousedown', e => {
        if (e.button === 0) {
            isPanning = true;
            panStart = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
        }
    });

    canvas.addEventListener('mousemove', e => {
        if (isPanning) {
            const deltaX = e.clientX - panStart.x;
            const deltaY = e.clientY - panStart.y;
            const { x, y } = window.chart.scales;
            const xRange = x.max - x.min;
            const yRange = y.max - y.min;
            const xPixelRatio = xRange / window.chart.width;
            const yPixelRatio = yRange / window.chart.height;

            x.options.min -= deltaX * xPixelRatio;
            x.options.max -= deltaX * xPixelRatio;
            y.options.min += deltaY * yPixelRatio;
            y.options.max += deltaY * yPixelRatio;

            window.chart.update('none');
            panStart = { x: e.clientX, y: e.clientY };
        }
    });

    ['mouseup', 'mouseleave'].forEach(event => {
        canvas.addEventListener(event, () => {
            isPanning = false;
            canvas.style.cursor = 'grab';
            window.chart.update('none');
        });
    });

    elements.zoomToFit.addEventListener('click', () => {
        window.chart.scales.x.options.min = initialBounds.x.min;
        window.chart.scales.x.options.max = initialBounds.x.max;
        window.chart.scales.y.options.min = initialBounds.y.min;
        window.chart.scales.y.options.max = initialBounds.y.max;
        window.chart.update('active');
    });

    elements.resetZoom.addEventListener('click', () => {
        window.chart.scales.x.options.min = initialBounds.x.min;
        window.chart.scales.x.options.max = initialBounds.x.max;
        window.chart.scales.y.options.min = initialBounds.y.min;
        window.chart.scales.y.options.max = initialBounds.y.max;
        window.chart.resetZoom();
        canvas.style.cursor = 'grab';
        window.chart.update('none');
    });

    new MutationObserver(() => {
        if (window.chart) updateChartColors(window.chart);
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}