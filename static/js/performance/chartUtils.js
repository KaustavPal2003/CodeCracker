function getChartColors() {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    return {
        textColor: isDarkTheme ? '#ecf0f1' : '#2c3e50',
        gridColor: isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
        backgroundColor: isDarkTheme ? '#2d2d2d' : '#ffffff',
        codeforcesColor: isDarkTheme ? '#87cefa' : '#3498db',
        codechefColor: isDarkTheme ? '#ffa07a' : '#e74c3c',
        leetcodeColor: isDarkTheme ? '#2ecc71' : '#2ecc71'
    };
}

function updateChartColors(chart) {
    const colors = getChartColors();
    chart.options.scales.x.title.color = colors.textColor;
    chart.options.scales.x.ticks.color = colors.textColor;
    chart.options.scales.x.grid.color = colors.gridColor;
    chart.options.scales.y.title.color = colors.textColor;
    chart.options.scales.y.ticks.color = colors.textColor;
    chart.options.scales.y.grid.color = colors.gridColor;
    chart.options.plugins.tooltip.backgroundColor = colors.backgroundColor + 'cc';
    chart.options.plugins.tooltip.titleColor = colors.textColor;
    chart.options.plugins.tooltip.bodyColor = colors.textColor;
    chart.options.plugins.tooltip.borderColor = colors.textColor;
    chart.options.plugins.legend.labels.color = colors.textColor;
    chart.options.backgroundColor = colors.backgroundColor;

    chart.data.datasets[0].borderColor = colors.codeforcesColor;
    chart.data.datasets[0].backgroundColor = colors.codeforcesColor + '33';
    chart.data.datasets[1].borderColor = colors.codechefColor;
    chart.data.datasets[1].backgroundColor = colors.codechefColor + '33';
    chart.data.datasets[2].borderColor = colors.leetcodeColor;
    chart.data.datasets[2].backgroundColor = colors.leetcodeColor + '33';

    chart.update();
}

function updateChart(data) {
    const ctx = document.getElementById("ratingChart")?.getContext("2d");
    const chartCanvas = document.getElementById("ratingChart");
    const noDataMessage = document.getElementById("no-data-message");
    const resetZoomButton = document.getElementById("reset-zoom");
    const zoomToFitButton = document.getElementById("zoom-to-fit");
    const colors = getChartColors();

    if (!ctx || !chartCanvas) {
        console.error("Chart canvas or context not found!");
        return;
    }

    console.log("Data received for chart update:", data);

    if (!data || !data.rating_history || !Array.isArray(data.rating_history) || data.rating_history.length === 0) {
        console.warn("No valid rating history data available");
        chartCanvas.style.display = "none";
        if (noDataMessage) noDataMessage.style.display = "block";
        if (resetZoomButton) resetZoomButton.style.display = "none";
        if (zoomToFitButton) zoomToFitButton.style.display = "none";
        return;
    }

    if (isInitialLoadComplete) {
        chartCanvas.style.display = "block";
        if (noDataMessage) noDataMessage.style.display = "none";
        if (resetZoomButton) resetZoomButton.style.display = "block";
        if (zoomToFitButton) zoomToFitButton.style.display = "block";
    } else {
        console.log("Initial load not complete yet, chart remains hidden.");
        return;
    }

    const codeforcesData = data.rating_history
        .filter(h => h.platform === "Codeforces")
        .map(h => ({
            x: new Date(h.date).getTime(),
            y: h.new_rating || 0,
            contest: h.contest || "Unknown Contest",
            rank: h.rank || "N/A"
        }));

    const codechefData = data.rating_history
        .filter(h => h.platform === "Codechef")
        .map(h => ({
            x: new Date(h.date).getTime(),
            y: h.new_rating || 0,
            contest: h.contest || "Unknown Contest",
            rank: h.rank || "N/A"
        }));

    const leetcodeData = data.rating_history
        .filter(h => h.platform === "Leetcode")
        .map(h => ({
            x: new Date(h.date).getTime(),
            y: h.new_rating || 0,
            contest: h.contest || "Unknown Contest",
            rank: h.rank || "N/A"
        }));

    const allDates = [
        ...codeforcesData.map(d => d.x),
        ...codechefData.map(d => d.x),
        ...leetcodeData.map(d => d.x)
    ].filter(date => date !== undefined && !isNaN(date));

    const allRatings = [
        ...codeforcesData.map(d => d.y),
        ...codechefData.map(d => d.y),
        ...leetcodeData.map(d => d.y)
    ].filter(rating => rating !== undefined && !isNaN(rating));

    if (allDates.length === 0 || allRatings.length === 0) {
        console.warn("No valid data points to display in the chart");
        chartCanvas.style.display = "none";
        if (noDataMessage) noDataMessage.style.display = "block";
        if (resetZoomButton) resetZoomButton.style.display = "none";
        if (zoomToFitButton) zoomToFitButton.style.display = "none";
        return;
    }

    console.log("Creating chart with datasets:", { codeforcesData, codechefData, leetcodeData });

    const minDate = Math.min(...allDates);
    const maxDate = Math.max(...allDates);
    const minRating = Math.min(...allRatings);
    const maxRating = Math.max(...allRatings);
    const dateRange = maxDate - minDate;
    const ratingRange = maxRating - minRating;
    const datePadding = dateRange * 0.2;
    const ratingPadding = ratingRange * 0.2 || 50;

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: `${username} - Codeforces`,
                    data: codeforcesData,
                    borderColor: colors.codeforcesColor,
                    backgroundColor: colors.codeforcesColor + '33',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: `${username} - CodeChef`,
                    data: codechefData,
                    borderColor: colors.codechefColor,
                    backgroundColor: colors.codechefColor + '33',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: `${username} - LeetCode`,
                    data: leetcodeData,
                    borderColor: colors.leetcodeColor,
                    backgroundColor: colors.leetcodeColor + '33',
                    fill: false,
                    tension: 0.3,
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
                        },
                        tooltipFormat: 'MMM D, YYYY'
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        color: colors.textColor,
                        font: { size: 16, weight: 'bold' }
                    },
                    ticks: {
                        color: colors.textColor,
                        font: { size: 14 },
                        maxRotation: 45,
                        minRotation: 0
                    },
                    grid: {
                        color: colors.gridColor
                    },
                    min: minDate - datePadding,
                    max: maxDate + datePadding
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
                        font: { size: 14 },
                        stepSize: Math.ceil(ratingRange / 5) || 50
                    },
                    grid: {
                        color: colors.gridColor
                    },
                    beginAtZero: false,
                    min: Math.max(0, minRating - ratingPadding),
                    max: maxRating + ratingPadding
                }
            },
            plugins: {
                tooltip: {
                    enabled: true,
                    backgroundColor: colors.backgroundColor + 'cc',
                    titleColor: colors.textColor,
                    bodyColor: colors.textColor,
                    borderColor: colors.textColor,
                    borderWidth: 1,
                    callbacks: {
                        label: function (context) {
                            const point = context.raw;
                            return `${context.dataset.label}: ${point.y} (Contest: ${point.contest}, Rank: ${point.rank})`;
                        }
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'xy',
                        speed: 20,
                        threshold: 10,
                        onPanStart: function ({ chart }) {
                            isPanning = true;
                            chart.canvas.style.cursor = 'grabbing';
                        },
                        onPan: function ({ chart }) {
                            chart.canvas.style.cursor = 'grabbing';
                        },
                        onPanComplete: function ({ chart }) {
                            isPanning = false;
                            chart.canvas.style.cursor = 'grab';
                        }
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'xy'
                    },
                    limits: {
                        x: {
                            min: minDate - datePadding * 2,
                            max: maxDate + datePadding * 2,
                            minRange: dateRange / 10
                        },
                        y: {
                            min: Math.max(0, minRating - ratingPadding * 2),
                            max: maxRating + ratingPadding * 2,
                            minRange: ratingRange / 10 || 100
                        }
                    }
                },
                legend: {
                    labels: {
                        color: colors.textColor,
                        font: { size: 14 },
                        usePointStyle: true,
                        padding: 20
                    },
                    onClick: function (e, legendItem, legend) {
                        const index = legendItem.datasetIndex;
                        const ci = legend.chart;
                        const meta = ci.getDatasetMeta(index);
                        meta.hidden = !meta.hidden;
                        ci.update();
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                intersect: false,
                axis: 'x'
            },
            backgroundColor: colors.backgroundColor
        }
    });

    console.log("Chart created successfully:", chart);

    chart.canvas.style.cursor = 'grab';

    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;

    chart.canvas.addEventListener('mousedown', function (event) {
        if (event.button === 0) {
            isPanning = true;
            panStartX = event.clientX;
            panStartY = event.clientY;
            chart.canvas.style.cursor = 'grabbing';
        }
    });

    chart.canvas.addEventListener('mousemove', function (event) {
        if (isPanning) {
            const deltaX = event.clientX - panStartX;
            const deltaY = event.clientY - panStartY;
            const xScale = chart.scales.x;
            const yScale = chart.scales.y;
            const xRange = xScale.max - xScale.min;
            const yRange = yScale.max - yScale.min;
            const xPixelRatio = xRange / chart.width;
            const yPixelRatio = yRange / chart.height;

            const panX = deltaX * xPixelRatio;
            const panY = deltaY * yPixelRatio;

            xScale.options.min -= panX;
            xScale.options.max -= panX;
            yScale.options.min += panY;
            yScale.options.max += panY;

            chart.update('none');
            panStartX = event.clientX;
            panStartY = event.clientY;
        }
    });

    chart.canvas.addEventListener('mouseup', function () {
        isPanning = false;
        chart.canvas.style.cursor = 'grab';
        chart.update('none');
    });

    chart.canvas.addEventListener('mouseleave', function () {
        isPanning = false;
        chart.canvas.style.cursor = 'grab';
        chart.update('none');
    });

    document.getElementById('reset-zoom')?.addEventListener('click', function () {
        chart.scales.x.options.min = minDate - datePadding;
        chart.scales.x.options.max = maxDate + datePadding;
        chart.scales.y.options.min = Math.max(0, minRating - ratingPadding);
        chart.scales.y.options.max = maxRating + ratingPadding;
        chart.resetZoom();
        chart.canvas.style.cursor = 'grab';
        chart.update('none');
    });

    document.getElementById('zoom-to-fit')?.addEventListener('click', function () {
        chart.scales.x.options.min = minDate - datePadding;
        chart.scales.x.options.max = maxDate + datePadding;
        chart.scales.y.options.min = Math.max(0, minRating - ratingPadding);
        chart.scales.y.options.max = maxRating + ratingPadding;
        chart.update('active');
    });
}