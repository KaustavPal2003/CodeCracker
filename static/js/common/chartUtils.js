import { showError } from './utils.js';

// Centralized platform configuration
const PLATFORMS = ['Codeforces', 'CodeChef', 'LeetCode'];

function getChartColors(mode = 'performance') {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    const baseColors = {
        text: isDarkTheme ? '#ffffff' : '#2c3e50',
        grid: isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
        background: isDarkTheme ? '#2d2d2d' : '#ffffff'
    };

    const platforms = {
        codeforces: { main: isDarkTheme ? '#1e90ff' : '#4169e1', compare: '#ff4500' },
        codechef: { main: isDarkTheme ? '#ff6347' : '#dc143c', compare: '#8a2be2' },
        leetcode: { main: '#32cd32', compare: '#ffa500' }
    };

    if (mode === 'performance') {
        platforms.codeforces = platforms.codeforces.main;
        platforms.codechef = platforms.codechef.main;
        platforms.leetcode = platforms.leetcode.main;
    }

    return { ...baseColors, platforms };
}

function getChartElements() {
    const elements = {
        ctx: document.getElementById('ratingChart')?.getContext('2d'),
        noDataMessage: document.getElementById('no-data-message-chart'),
        zoomToFit: document.getElementById('zoom-to-fit'),
        resetZoom: document.getElementById('reset-zoom'),
        detailsDiv: document.getElementById('chart-details')
    };
    const missing = Object.keys(elements).filter(key => !elements[key] && key !== 'detailsDiv');
    if (missing.length) {
        console.error('Missing required chart DOM elements:', missing);
    }
    return elements;
}

export function updateChartColors(chart) {
    if (!chart) return;
    const colors = getChartColors(chart.data.mode || 'performance');

    const scales = chart.options.scales;
    ['x', 'y'].forEach(axis => {
        scales[axis].title.color = colors.text;
        scales[axis].ticks.color = colors.text;
        scales[axis].grid.color = colors.grid;
    });

    const { codeforces, codechef, leetcode } = colors.platforms;
    const datasets = chart.data.datasets;
    if (chart.data.mode === 'compare') {
        const hasCompareData = datasets.length > 3;
        datasets[0].borderColor = codeforces.main;
        datasets[0].backgroundColor = codeforces.main + '33';
        datasets[1].borderColor = codechef.main;
        datasets[1].backgroundColor = codechef.main + '33';
        datasets[2].borderColor = leetcode.main;
        datasets[2].backgroundColor = leetcode.main + '33';
        if (hasCompareData) {
            datasets[3].borderColor = codeforces.compare;
            datasets[3].backgroundColor = codeforces.compare + '33';
            datasets[4].borderColor = codechef.compare;
            datasets[4].backgroundColor = codechef.compare + '33';
            datasets[5].borderColor = leetcode.compare;
            datasets[5].backgroundColor = leetcode.compare + '33';
        }
    } else {
        datasets[0].borderColor = codeforces;
        datasets[0].backgroundColor = codeforces + '33';
        datasets[1].borderColor = codechef;
        datasets[1].backgroundColor = codechef + '33';
        datasets[2].borderColor = leetcode;
        datasets[2].backgroundColor = leetcode + '33';
    }

    chart.options.plugins.tooltip = {
        backgroundColor: colors.background + 'cc',
        titleColor: colors.text,
        bodyColor: colors.text,
        borderColor: colors.text
    };
    chart.options.plugins.legend.labels.color = colors.text;
    chart.options.backgroundColor = colors.background;
    chart.canvas.style.backgroundColor = colors.background;

    if (chart.canvas && document.body.contains(chart.canvas)) {
        chart.update('active');
    }
}

function processRatingData(ratingHistory, platform) {
    const MAX_DATA_POINTS = 1000;
    if (!Array.isArray(ratingHistory) || !ratingHistory.length) {
        console.warn(`No valid rating history for platform ${platform}`);
        return [];
    }
    let data = ratingHistory
        .filter(h => h?.platform?.toLowerCase() === platform.toLowerCase() && h?.date)
        .map(h => {
            const date = new Date(h.date);
            if (isNaN(date.getTime())) {
                console.warn(`Invalid date for ${platform} entry:`, h.date);
                return null;
            }
            return {
                x: date.getTime(),
                y: h.new_rating || 0,
                contest: h.contest,
                rank: h.rank
            };
        })
        .filter(d => d !== null);

    if (data.length > MAX_DATA_POINTS) {
        console.log(`Reducing ${platform} data points from ${data.length} to ${MAX_DATA_POINTS}`);
        const step = Math.floor(data.length / MAX_DATA_POINTS);
        data = data.filter((_, index) => index % step === 0).slice(0, MAX_DATA_POINTS);
    }
    return data;
}

export function updateChart(user1Data, compareData, user1Username, user2Username, mode = 'performance') {
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded');
        showError('Chart.js is not available. Please check your script imports.');
        return null;
    }

    if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
        console.warn('DOM not fully loaded before chart initialization');
        showError('Page not fully loaded. Please refresh.');
        return null;
    }

    const elements = getChartElements();
    if (!elements.ctx || !elements.noDataMessage || !elements.zoomToFit || !elements.resetZoom) {
        console.error('Missing required chart DOM elements (canvas, no-data-message, zoom controls)');
        showError('Failed to render chart: Missing canvas or zoom controls');
        return null;
    }

    if (!user1Data?.rating_history) {
        console.error('Missing rating history for user 1', { user1Data });
        showError('Cannot render chart: Missing rating history for user');
        elements.noDataMessage.style.display = 'block';
        elements.zoomToFit.style.display = 'none';
        elements.resetZoom.style.display = 'none';
        if (elements.detailsDiv) elements.detailsDiv.style.display = 'none';
        return null;
    }

    // Destroy existing chart instance if it exists
    const existingChart = Chart.getChart(elements.ctx);
    if (existingChart) {
        existingChart.destroy();
        console.log('Destroyed existing chart instance on canvas #ratingChart');
    }

    const colors = getChartColors(mode);
    const canvas = elements.ctx.canvas;
    let observer = null;

    const datasets = mode === 'compare'
        ? [
            ...PLATFORMS.map(platform => ({
                label: `${user1Username} - ${platform}`,
                data: processRatingData(user1Data?.rating_history, platform),
                borderColor: colors.platforms[platform.toLowerCase()].main,
                backgroundColor: colors.platforms[platform.toLowerCase()].main + '33'
            })),
            ...(compareData?.rating_history
                ? PLATFORMS.map(platform => ({
                    label: `${compareData?.username || user2Username || 'Compare'} - ${platform}`,
                    data: processRatingData(compareData?.rating_history, platform),
                    borderColor: colors.platforms[platform.toLowerCase()].compare,
                    backgroundColor: colors.platforms[platform.toLowerCase()].compare + '33'
                }))
                : [])
        ]
        : PLATFORMS.map(platform => ({
            label: `${user1Username} - ${platform}`,
            data: processRatingData(user1Data?.rating_history, platform),
            borderColor: colors.platforms[platform.toLowerCase()],
            backgroundColor: colors.platforms[platform.toLowerCase()] + '33'
        }));

    const allDates = datasets.flatMap(ds => ds.data.map(d => d.x)).filter(d => d);
    const allRatings = datasets.flatMap(ds => ds.data.map(d => d.y)).filter(r => r);
    if (!allDates.length || !allRatings.length) {
        console.warn('No valid data points for chart');
        elements.noDataMessage.style.display = 'block';
        elements.zoomToFit.style.display = 'none';
        elements.resetZoom.style.display = 'none';
        if (elements.detailsDiv) elements.detailsDiv.style.display = 'none';
        return null;
    }

    elements.noDataMessage.style.display = 'none';
    elements.zoomToFit.style.display = 'block';
    elements.resetZoom.style.display = 'block';
    if (elements.detailsDiv) elements.detailsDiv.style.display = 'none';

    const [minDate, maxDate] = [Math.min(...allDates), Math.max(...allDates)];
    const [minRating, maxRating] = [Math.min(...allRatings), Math.max(...allRatings)];
    const dateRange = maxDate - minDate || 1;
    const ratingRange = maxRating - minRating || 1;
    const padding = 0.2;
    const initialBounds = {
        x: { min: minDate - dateRange * padding, max: maxDate + dateRange * padding },
        y: { min: Math.max(0, minRating - ratingRange * padding), max: maxRating + ratingRange * padding }
    };

    const chart = new Chart(elements.ctx, {
        type: 'line',
        data: { datasets: datasets.map(ds => ({ ...ds, fill: false, tension: 0.1, pointRadius: 4, pointHoverRadius: 6, mode })) },
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
                if (elements.length && elements.detailsDiv) {
                    const { datasetIndex, index } = elements[0];
                    const point = chart.data.datasets[datasetIndex].data[index];
                    elements.detailsDiv.textContent = `Contest: ${point.contest || 'N/A'}, Rank: ${point.rank || 'N/A'}, Rating: ${point.y}`;
                    elements.detailsDiv.style.display = 'block';
                } else if (elements.detailsDiv) {
                    elements.detailsDiv.style.display = 'none';
                }
            }
        }
    });

    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    canvas.style.cursor = 'grab';

    const eventListeners = {
        mousedown: e => {
            if (e.button === 0) {
                isPanning = true;
                panStart = { x: e.clientX, y: e.clientY };
                canvas.style.cursor = 'grabbing';
            }
        },
        mousemove: e => {
            if (isPanning && document.body.contains(canvas)) {
                const deltaX = e.clientX - panStart.x;
                const deltaY = e.clientY - panStart.y;
                const { x, y } = chart.scales;
                const xRange = x.max - x.min;
                const yRange = y.max - y.min;
                const xPixelRatio = xRange / chart.width;
                const yPixelRatio = yRange / chart.height;

                x.options.min -= deltaX * xPixelRatio;
                x.options.max -= deltaX * xPixelRatio;
                y.options.min += deltaY * yPixelRatio;
                y.options.max += deltaY * yPixelRatio;

                chart.update('none');
                panStart = { x: e.clientX, y: e.clientY };
            }
        },
        mouseup: () => {
            isPanning = false;
            canvas.style.cursor = 'grab';
            if (document.body.contains(canvas)) {
                chart.update('none');
            }
        },
        mouseleave: () => {
            isPanning = false;
            canvas.style.cursor = 'grab';
            if (document.body.contains(canvas)) {
                chart.update('none'); // Line 325
            }
        }
    };

    Object.keys(eventListeners).forEach(event => {
        canvas.addEventListener(event, eventListeners[event]);
    });

    elements.zoomToFit.addEventListener('click', () => {
        if (document.body.contains(canvas)) {
            chart.scales.x.options.min = initialBounds.x.min;
            chart.scales.x.options.max = initialBounds.x.max;
            chart.scales.y.options.min = initialBounds.y.min;
            chart.scales.y.options.max = initialBounds.y.max;
            chart.update('active');
            if (elements.detailsDiv) elements.detailsDiv.style.display = 'none';
        }
    });

    elements.resetZoom.addEventListener('click', () => {
        if (document.body.contains(canvas)) {
            chart.scales.x.options.min = initialBounds.x.min;
            chart.scales.x.options.max = initialBounds.x.max;
            chart.scales.y.options.min = initialBounds.y.min;
            chart.scales.y.options.max = initialBounds.y.max;
            chart.resetZoom();
            canvas.style.cursor = 'grab';
            chart.update('none');
            if (elements.detailsDiv) elements.detailsDiv.style.display = 'none';
        }
    });

    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
        if (document.body.contains(canvas)) {
            updateChartColors(chart);
        }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    chart.cleanup = () => {
        Object.keys(eventListeners).forEach(event => {
            canvas.removeEventListener(event, eventListeners[event]);
        });
        if (observer) observer.disconnect();
        if (document.body.contains(canvas)) {
            chart.destroy();
        }
    };

    return chart;
}