// chartUtils.js
function getChartColors() {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    return {
        textColor: isDarkTheme ? '#ecf0f1' : '#2c3e50',
        gridColor: isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
        backgroundColor: isDarkTheme ? '#2d2d2d' : '#ffffff',
        codeforcesColor: isDarkTheme ? '#87cefa' : '#3498db',
        codeforcesCompareColor: isDarkTheme ? '#f1c40f' : '#f1c40f',
        codechefColor: isDarkTheme ? '#ffa07a' : '#e74c3c',
        codechefCompareColor: isDarkTheme ? '#9b59b6' : '#9b59b6',
        leetcodeColor: isDarkTheme ? '#2ecc71' : '#2ecc71',
        leetcodeCompareColor: isDarkTheme ? '#e67e22' : '#e67e22'
    };
}

function updateChartColors(chart) {
    if (!chart) return;
    const colors = getChartColors();

    chart.options.scales.x.title.color = colors.textColor;
    chart.options.scales.x.ticks.color = colors.textColor;
    chart.options.scales.x.grid.color = colors.gridColor;
    chart.options.scales.y.title.color = colors.textColor;
    chart.options.scales.y.ticks.color = colors.textColor;
    chart.options.scales.y.grid.color = colors.gridColor;

    chart.data.datasets[0].borderColor = colors.codeforcesColor;
    chart.data.datasets[0].backgroundColor = colors.codeforcesColor + '33';
    chart.data.datasets[1].borderColor = colors.codechefColor;
    chart.data.datasets[1].backgroundColor = colors.codechefColor + '33';
    chart.data.datasets[2].borderColor = colors.leetcodeColor;
    chart.data.datasets[2].backgroundColor = colors.leetcodeColor + '33';
    chart.data.datasets[3].borderColor = colors.codeforcesCompareColor;
    chart.data.datasets[3].backgroundColor = colors.codeforcesCompareColor + '33';
    chart.data.datasets[4].borderColor = colors.codechefCompareColor;
    chart.data.datasets[4].backgroundColor = colors.codechefCompareColor + '33';
    chart.data.datasets[5].borderColor = colors.leetcodeCompareColor;
    chart.data.datasets[5].backgroundColor = colors.leetcodeCompareColor + '33';

    chart.options.plugins.tooltip.backgroundColor = colors.backgroundColor + 'cc';
    chart.options.plugins.tooltip.titleColor = colors.textColor;
    chart.options.plugins.tooltip.bodyColor = colors.textColor;
    chart.options.plugins.tooltip.borderColor = colors.textColor;
    chart.options.plugins.legend.labels.color = colors.textColor;

    chart.options.backgroundColor = colors.backgroundColor;
    chart.update('active');
}

function updateChart(data, user1Username, user2Username) {
    const ctx = document.getElementById('ratingChart').getContext('2d');
    const colors = getChartColors();

    if (window.chart) {
        window.chart.destroy();
    }

    const codeforcesData = (data.rating_history || [])
        .filter(h => h && h.platform === 'Codeforces')
        .map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0, contest: h.contest, rank: h.rank }));
    const codechefData = (data.rating_history || [])
        .filter(h => h && h.platform === 'Codechef')
        .map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0, contest: h.contest, rank: h.rank }));
    const leetcodeData = (data.rating_history || [])
        .filter(h => h && h.platform === 'Leetcode')
        .map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0, contest: h.contest, rank: h.rank }));
    const compareCodeforcesData = (data.compare_rating_history || [])
        .filter(h => h && h.platform === 'Codeforces')
        .map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0, contest: h.contest, rank: h.rank }));
    const compareCodechefData = (data.compare_rating_history || [])
        .filter(h => h && h.platform === 'Codechef')
        .map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0, contest: h.contest, rank: h.rank }));
    const compareLeetcodeData = (data.compare_rating_history || [])
        .filter(h => h && h.platform === 'Leetcode')
        .map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0, contest: h.contest, rank: h.rank }));

    console.log('Chart data:', { codeforcesData, compareCodeforcesData, user1Username, user2Username });

    const allDates = [
        ...codeforcesData.map(d => d.x),
        ...codechefData.map(d => d.x),
        ...leetcodeData.map(d => d.x),
        ...compareCodeforcesData.map(d => d.x),
        ...compareCodechefData.map(d => d.x),
        ...compareLeetcodeData.map(d => d.x)
    ].filter(date => date !== undefined && !isNaN(date));

    const allRatings = [
        ...codeforcesData.map(d => d.y),
        ...codechefData.map(d => d.y),
        ...leetcodeData.map(d => d.y),
        ...compareCodeforcesData.map(d => d.y),
        ...compareCodechefData.map(d => d.y),
        ...compareLeetcodeData.map(d => d.y)
    ].filter(rating => rating !== undefined && !isNaN(rating));

    if (allDates.length === 0 || allRatings.length === 0) {
        console.error('No valid data points found');
        document.getElementById("no-data-message").style.display = 'block';
        document.getElementById("zoom-to-fit").style.display = 'none';
        document.getElementById("reset-zoom").style.display = 'none';
        return;
    }

    document.getElementById("no-data-message").style.display = 'none';
    document.getElementById("zoom-to-fit").style.display = 'block';
    document.getElementById("reset-zoom").style.display = 'block';

    const minDate = Math.min(...allDates);
    const maxDate = Math.max(...allDates);
    const minRating = Math.min(...allRatings);
    const maxRating = Math.max(...allRatings);
    const dateRange = maxDate - minDate || 1;
    const ratingRange = maxRating - minRating || 1;
    const datePadding = dateRange * 0.2;
    const ratingPadding = ratingRange * 0.2;

    const initialMinDate = minDate - datePadding;
    const initialMaxDate = maxDate + datePadding;
    const initialMinRating = Math.max(0, minRating - ratingPadding);
    const initialMaxRating = maxRating + ratingPadding;

    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;

    window.chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: `${user1Username} - Codeforces`,
                    data: codeforcesData,
                    borderColor: colors.codeforcesColor,
                    backgroundColor: colors.codeforcesColor + '33',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: `${user1Username} - CodeChef`,
                    data: codechefData,
                    borderColor: colors.codechefColor,
                    backgroundColor: colors.codechefColor + '33',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: `${user1Username} - LeetCode`,
                    data: leetcodeData,
                    borderColor: colors.leetcodeColor,
                    backgroundColor: colors.leetcodeColor + '33',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: `${user2Username || 'Compare'} - Codeforces`,
                    data: compareCodeforcesData,
                    borderColor: colors.codeforcesCompareColor,
                    backgroundColor: colors.codeforcesCompareColor + '33',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: `${user2Username || 'Compare'} - CodeChef`,
                    data: compareCodechefData,
                    borderColor: colors.codechefCompareColor,
                    backgroundColor: colors.codechefCompareColor + '33',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: `${user2Username || 'Compare'} - LeetCode`,
                    data: compareLeetcodeData,
                    borderColor: colors.leetcodeCompareColor,
                    backgroundColor: colors.leetcodeCompareColor + '33',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'month',
                        displayFormats: {
                            month: 'MMM YYYY'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        color: colors.textColor,
                        font: { size: 16, weight: 'bold' }
                    },
                    ticks: {
                        color: colors.textColor,
                        font: { size: 14 }
                    },
                    grid: {
                        color: colors.gridColor
                    },
                    min: initialMinDate,
                    max: initialMaxDate
                },
                y: {
                    title: {
                        display: true,
                        text: 'Rating',
                        color: colors.textColor,
                        font: { size: 16, weight: 'bold' }
                    },
                    ticks: {
                        color: colors.textColor,
                        font: { size: 14 }
                    },
                    grid: {
                        color: colors.gridColor
                    },
                    beginAtZero: false,
                    min: initialMinRating,
                    max: initialMaxRating
                }
            },
            plugins: {
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'xy',
                        speed: 20,
                        threshold: 0,
                        onPanStart: ({chart}) => {
                            isPanning = true;
                            chart.canvas.style.cursor = 'grabbing';
                        },
                        onPan: ({chart, delta}) => {
                            chart.canvas.style.cursor = 'grabbing';
                            chart.update('none');
                        },
                        onPanComplete: ({chart}) => {
                            isPanning = false;
                            chart.canvas.style.cursor = 'grab';
                            chart.update('none');
                        }
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        mode: 'xy'
                    },
                    limits: {
                        x: { min: minDate - datePadding * 2, max: maxDate + datePadding * 2, minRange: dateRange / 10 },
                        y: { min: Math.max(0, minRating - ratingPadding * 2), max: maxRating + ratingPadding * 2, minRange: ratingRange / 10 }
                    }
                },
                legend: {
                    labels: {
                        color: colors.textColor,
                        font: { size: 14 },
                        usePointStyle: true
                    },
                    onClick: (e, legendItem, legend) => {
                        const index = legendItem.datasetIndex;
                        const ci = legend.chart;
                        ci.getDatasetMeta(index).hidden = !ci.getDatasetMeta(index).hidden;
                        ci.update();
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: colors.backgroundColor + 'cc',
                    titleColor: colors.textColor,
                    bodyColor: colors.textColor,
                    borderColor: colors.textColor,
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return `${context.dataset.label}: ${point.y} (Contest: ${point.contest || 'N/A'}, Rank: ${point.rank || 'N/A'})`;
                        }
                    }
                }
            },
            backgroundColor: colors.backgroundColor,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const element = elements[0];
                    const dataset = window.chart.data.datasets[element.datasetIndex];
                    const point = dataset.data[element.index];
                    alert(`Contest: ${point.contest || 'N/A'}\nRank: ${point.rank || 'N/A'}\nRating: ${point.y}`);
                }
            }
        }
    });

    window.chart.canvas.style.cursor = 'grab';

    window.chart.canvas.addEventListener('mousedown', (event) => {
        if (event.button === 0) {
            isPanning = true;
            panStartX = event.clientX;
            panStartY = event.clientY;
            window.chart.canvas.style.cursor = 'grabbing';
        }
    });

    window.chart.canvas.addEventListener('mousemove', (event) => {
        if (isPanning) {
            const deltaX = event.clientX - panStartX;
            const deltaY = event.clientY - panStartY;
            const xScale = window.chart.scales.x;
            const yScale = window.chart.scales.y;
            const xRange = xScale.max - xScale.min;
            const yRange = yScale.max - yScale.min;
            const xPixelRatio = xRange / window.chart.width;
            const yPixelRatio = yRange / window.chart.height;

            const panX = deltaX * xPixelRatio;
            const panY = deltaY * yPixelRatio;

            xScale.options.min -= panX;
            xScale.options.max -= panX;
            yScale.options.min += panY;
            yScale.options.max += panY;

            window.chart.update('none');
            panStartX = event.clientX;
            panStartY = event.clientY;
        }
    });

    window.chart.canvas.addEventListener('mouseup', () => {
        isPanning = false;
        window.chart.canvas.style.cursor = 'grab';
        window.chart.update('none');
    });

    window.chart.canvas.addEventListener('mouseleave', () => {
        isPanning = false;
        window.chart.canvas.style.cursor = 'grab';
        window.chart.update('none');
    });

    const zoomToFitButton = document.getElementById('zoom-to-fit');
    zoomToFitButton.addEventListener('click', () => {
        window.chart.scales.x.options.min = initialMinDate;
        window.chart.scales.x.options.max = initialMaxDate;
        window.chart.scales.y.options.min = initialMinRating;
        window.chart.scales.y.options.max = initialMaxRating;
        window.chart.update('active');
    });

    const resetZoomButton = document.getElementById('reset-zoom');
    resetZoomButton.addEventListener('click', () => {
        window.chart.scales.x.options.min = initialMinDate;
        window.chart.scales.x.options.max = initialMaxDate;
        window.chart.scales.y.options.min = initialMinRating;
        window.chart.scales.y.options.max = initialMaxRating;
        window.chart.resetZoom();
        window.chart.canvas.style.cursor = 'grab';
        window.chart.update('none');
    });
}