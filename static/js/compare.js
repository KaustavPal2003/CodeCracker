document.addEventListener('DOMContentLoaded', function () {
    console.log('Script loaded successfully');
    console.log('Moment available:', typeof moment !== 'undefined' ? 'Yes' : 'No');
    console.log('Chart.js version:', Chart.version);
    console.log('Adapter registered:', typeof Chart._adapters !== 'undefined' && typeof Chart._adapters._date !== 'undefined' ? 'Yes' : 'No');

    const username = document.getElementById('username-data').dataset.username;
    const fetchUrl = document.getElementById('fetch-url').dataset.url;
    const wsUrl = `ws://${window.location.host}/ws/stats/${username}/`;
    const ws = new WebSocket(wsUrl);

    let lastData = null;
    let compareUsername = null;
    let chart = null;

    ws.onopen = function () {
        console.log(`WebSocket connected for ${username}`);
    };

    ws.onmessage = function (event) {
        const data = JSON.parse(event.data);
        console.log('Received WebSocket data:', data);

        if (lastData && JSON.stringify(data) !== JSON.stringify(lastData)) {
            showNotification('Data updated!');
        }
        lastData = data;

        updateStats(data, username, compareUsername);
        updateChart(data);
    };

    ws.onclose = function () {
        console.log(`WebSocket disconnected for ${username}`);
    };

    ws.onerror = function (error) {
        console.error('WebSocket error:', error);
    };

    function showNotification(message) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.style.display = 'block';
        setTimeout(() => notification.style.display = 'none', 3000);
    }

    function updateStats(data, username, compareUsername) {
        document.getElementById('codeforces-rating').textContent = data.codeforces_rating !== 'N/A' ? data.codeforces_rating : 'N/A';
        document.getElementById('leetcode-solved').textContent = data.leetcode_solved;
        document.getElementById('codechef-rating').textContent = data.codechef_rating !== 'N/A' ? data.codechef_rating : 'N/A';

        const historyBody = document.getElementById('history-body');
        const noHistory = document.getElementById('no-history');
        const historySection = document.getElementById('history-section');
        historyBody.innerHTML = '';
        if (noHistory) noHistory.remove();

        if (data.rating_history && data.rating_history.length > 0) {
            data.rating_history.forEach(entry => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${username}</td>
                    <td>${entry.platform}</td>
                    <td>${entry.contest}</td>
                    <td>${entry.rank || 'N/A'}</td>
                    <td>${entry.old_rating || 'N/A'}</td>
                    <td>${entry.new_rating || 'N/A'}</td>
                    <td>${entry.change || 'N/A'}</td>
                    <td>${entry.date.slice(0, 10)}</td>
                `;
                historyBody.appendChild(row);
            });
        }

        if (data.compare_rating_history && data.compare_rating_history.length > 0) {
            data.compare_rating_history.forEach(entry => {
                const row = document.createElement('tr');
                row.classList.add('compare-row');
                row.innerHTML = `
                    <td>${compareUsername}</td>
                    <td>${entry.platform}</td>
                    <td>${entry.contest}</td>
                    <td>${entry.rank || 'N/A'}</td>
                    <td>${entry.old_rating || 'N/A'}</td>
                    <td>${entry.new_rating || 'N/A'}</td>
                    <td>${entry.change || 'N/A'}</td>
                    <td>${entry.date.slice(0, 10)}</td>
                `;
                historyBody.appendChild(row);
            });
        }

        if (!data.rating_history && !data.compare_rating_history) {
            const noHistoryMsg = document.createElement('p');
            noHistoryMsg.id = 'no-history';
            noHistoryMsg.className = 'no-data';
            noHistoryMsg.textContent = 'No contest history available.';
            historySection.appendChild(noHistoryMsg);
        }

        if (compareUsername && data.compare_rating_history) {
            const compareCodeforces = data.compare_rating_history
                .filter(h => h.platform === 'Codeforces')
                .slice(-1)[0]?.new_rating || 'N/A';
            const compareCodechef = data.compare_rating_history
                .filter(h => h.platform === 'Codechef')
                .slice(-1)[0]?.new_rating || 'N/A';
            const compareLeetcode = data.leetcode_solved_compare || 0;

            document.getElementById('compare-username').textContent = compareUsername;
            document.getElementById('compare-codeforces-rating').textContent = compareCodeforces;
            document.getElementById('compare-leetcode-solved').textContent = compareLeetcode;
            document.getElementById('compare-codechef-rating').textContent = compareCodechef;
            document.getElementById('compare-section').style.display = 'block';
        } else {
            document.getElementById('compare-section').style.display = 'none';
        }
    }

    function updateChart(data) {
        const ctx = document.getElementById('ratingChart').getContext('2d');
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || (isDarkMode ? '#ffffff' : '#000000');
        const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--background-color').trim() || (isDarkMode ? '#2f2f2f' : '#ffffff');

        console.log('Is Dark Mode:', isDarkMode);
        console.log('Text Color:', textColor);
        console.log('Background Color:', backgroundColor);

        // Destroy existing chart if it exists
        if (chart) {
            chart.destroy();
        }

        // Prepare datasets
        const codeforcesData = (data.rating_history || [])
            .filter(h => h.platform === 'Codeforces')
            .map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0 }));
        const codechefData = (data.rating_history || [])
            .filter(h => h.platform === 'Codechef')
            .map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0 }));
        const leetcodeData = (data.rating_history || [])
            .filter(h => h.platform === 'Leetcode')
            .map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0 }));
        const compareCodeforcesData = (data.compare_rating_history || [])
            .filter(h => h.platform === 'Codeforces')
            .map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0 }));
        const compareCodechefData = (data.compare_rating_history || [])
            .filter(h => h.platform === 'Codechef')
            .map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0 }));
        const compareLeetcodeData = (data.compare_rating_history || [])
            .filter(h => h.platform === 'Leetcode')
            .map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0 }));

        // Calculate ranges
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
            const noDataMessage = document.getElementById("no-data-message");
            if (noDataMessage) noDataMessage.style.display = 'block';
            return;
        }

        const noDataMessage = document.getElementById("no-data-message");
        if (noDataMessage) noDataMessage.style.display = 'none';

        const minDate = Math.min(...allDates);
        const maxDate = Math.max(...allDates);
        const minRating = Math.min(...allRatings);
        const maxRating = Math.max(...allRatings);
        const dateRange = maxDate - minDate;
        const ratingRange = maxRating - minRating;
        const datePadding = dateRange * 0.2;
        const ratingPadding = ratingRange * 0.2;

        let isPanning = false;
        let panStartX = 0;
        let panStartY = 0;

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: `${username} - Codeforces`,
                        data: codeforcesData,
                        borderColor: '#3498db', // Blue, visible in both modes
                        backgroundColor: 'rgba(52, 152, 219, 0.2)',
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: `${username} - CodeChef`,
                        data: codechefData,
                        borderColor: '#e74c3c', // Red, visible in both modes
                        backgroundColor: 'rgba(231, 76, 60, 0.2)',
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: `${username} - LeetCode`,
                        data: leetcodeData,
                        borderColor: '#2ecc71', // Green, visible in both modes
                        backgroundColor: 'rgba(46, 204, 113, 0.2)',
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: `${compareUsername || 'Compare'} - Codeforces`,
                        data: compareCodeforcesData,
                        borderColor: '#f1c40f', // Yellow, visible in both modes
                        backgroundColor: 'rgba(241, 196, 15, 0.2)',
                        fill: false,
                        tension: 0.1,
                        hidden: !compareUsername
                    },
                    {
                        label: `${compareUsername || 'Compare'} - CodeChef`,
                        data: compareCodechefData,
                        borderColor: '#9b59b6', // Purple, visible in both modes
                        backgroundColor: 'rgba(155, 89, 182, 0.2)',
                        fill: false,
                        tension: 0.1,
                        hidden: !compareUsername
                    },
                    {
                        label: `${compareUsername || 'Compare'} - LeetCode`,
                        data: compareLeetcodeData,
                        borderColor: '#e67e22', // Orange, visible in both modes
                        backgroundColor: 'rgba(230, 126, 34, 0.2)',
                        fill: false,
                        tension: 0.1,
                        hidden: !compareUsername
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
                            color: textColor,
                            font: { size: 16, weight: 'bold' }
                        },
                        ticks: {
                            color: textColor,
                            font: { size: 14 }
                        },
                        grid: {
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        min: minDate - datePadding,
                        max: maxDate + datePadding
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Rating',
                            color: textColor,
                            font: { size: 16, weight: 'bold' }
                        },
                        ticks: {
                            color: textColor,
                            font: { size: 14 }
                        },
                        grid: {
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        beginAtZero: false,
                        min: minRating - ratingPadding,
                        max: maxRating + ratingPadding
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
                                console.log('Pan started');
                                isPanning = true;
                                chart.canvas.style.cursor = 'grabbing';
                            },
                            onPan: ({chart, delta}) => {
                                console.log('Panning with delta:', delta);
                                chart.canvas.style.cursor = 'grabbing';
                                chart.update('none');
                            },
                            onPanComplete: ({chart}) => {
                                console.log('Pan completed');
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
                            x: {
                                min: minDate - datePadding * 2,
                                max: maxDate + datePadding * 2,
                                minRange: dateRange / 10
                            },
                            y: {
                                min: minRating - ratingPadding * 2,
                                max: maxRating + ratingPadding * 2,
                                minRange: ratingRange / 10
                            }
                        }
                    },
                    legend: {
                        labels: {
                            color: textColor,
                            font: { size: 14 }
                        }
                    }
                },
                backgroundColor: backgroundColor
            }
        });

        chart.canvas.style.cursor = 'grab';

        // Manual pan handling (backup)
        chart.canvas.addEventListener('mousedown', (event) => {
            console.log('Mouse down:', { x: event.clientX, y: event.clientY });
            if (event.button === 0) {
                isPanning = true;
                panStartX = event.clientX;
                panStartY = event.clientY;
                chart.canvas.style.cursor = 'grabbing';
            }
        });

        chart.canvas.addEventListener('mousemove', (event) => {
            if (isPanning) {
                const deltaX = event.clientX - panStartX;
                const deltaY = event.clientY - panStartY;
                console.log('Manual pan delta:', { deltaX, deltaY });

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

                console.log('New scales:', {
                    x: { min: xScale.options.min, max: xScale.options.max },
                    y: { min: yScale.options.min, max: yScale.options.max }
                });

                chart.update('none');
                panStartX = event.clientX;
                panStartY = event.clientY;
            }
        });

        chart.canvas.addEventListener('mouseup', () => {
            console.log('Mouse up');
            isPanning = false;
            chart.canvas.style.cursor = 'grab';
            chart.update('none');
        });

        chart.canvas.addEventListener('mouseleave', () => {
            console.log('Mouse leave');
            isPanning = false;
            chart.canvas.style.cursor = 'grab';
            chart.update('none');
        });

        // Reset button
        const existingResetButton = document.getElementById('reset-zoom');
        if (!existingResetButton) {
            document.getElementById('chart-container').insertAdjacentHTML('beforeend',
                '<button id="reset-zoom">Reset Zoom</button>'
            );
            document.getElementById('reset-zoom').addEventListener('click', () => {
                console.log('Reset zoom');
                chart.scales.x.options.min = minDate - datePadding;
                chart.scales.x.options.max = maxDate + datePadding;
                chart.scales.y.options.min = minRating - ratingPadding;
                chart.scales.y.options.max = maxRating + ratingPadding;
                chart.resetZoom();
                chart.canvas.style.cursor = 'grab';
                chart.update('none');
            });
        }

        console.log('Chart initialized');
    }

    document.getElementById('compare-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        compareUsername = document.getElementById('compare_username').value.trim();
        if (compareUsername) {
            ws.send(JSON.stringify({ compare_to: compareUsername }));
        }
    });

    document.getElementById('clear-comparison').addEventListener('click', () => {
        compareUsername = null;
        document.getElementById('compare_username').value = '';
        ws.send(JSON.stringify({ compare_to: null }));
        document.getElementById('compare-section').style.display = 'none';
        const historyBody = document.getElementById('history-body');
        const compareRows = historyBody.querySelectorAll('.compare-row');
        compareRows.forEach(row => row.remove());
        updateChart(lastData);
    });

    // Observe theme changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-theme' && lastData) {
                console.log("Theme changed detected");
                if (chart) chart.destroy();
                updateChart(lastData);
            }
        });
    });
    observer.observe(document.documentElement, { attributes: true });
});