// Function to check if all required libraries are loaded
function waitForLibraries(callback) {
    const maxAttempts = 20;
    let attempts = 0;

    function checkLibs() {
        console.log("Checking libraries - Attempt:", attempts + 1);
        console.log("Chart.js:", typeof Chart !== 'undefined' ? "Yes" : "No");
        console.log("Moment:", typeof moment !== 'undefined' ? "Yes" : "No");
        console.log("Zoom plugin:", typeof chartjsPluginZoom !== 'undefined' ? "Yes" : "No");

        if (typeof Chart !== 'undefined' && typeof moment !== 'undefined' && typeof chartjsPluginZoom !== 'undefined') {
            console.log("All libraries loaded");
            callback();
        } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(checkLibs, 500); // Wait 500ms before retrying
        } else {
            console.error("Required libraries failed to load after", maxAttempts, "attempts. Chart will not render.");
        }
    }

    checkLibs();
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded");

    waitForLibraries(() => {
        Chart.register(chartjsPluginZoom);
        console.log("Zoom plugin registered:", Chart.registry.plugins.get('zoom') ? "Yes" : "No");

        const username = document.getElementById("username-data").dataset.username;
        const fetchUrl = document.getElementById("fetch-url").dataset.url;
        const wsUrl = `ws://${window.location.host}/ws/stats/${username}/`;
        const ws = new WebSocket(wsUrl);

        let lastData = null;
        let compareUsername = null;
        let chart = null;
        const canvas = document.getElementById("ratingChart");
        const ctx = canvas.getContext("2d");

        console.log("Canvas dimensions:", canvas.width, canvas.height);

        // Initialize chart
        canvas.style.cursor = "default";
        chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'month', displayFormats: { month: 'MMM YYYY' } },
                        title: { display: true, text: 'Date', font: { size: 16, weight: 'bold' } },
                        ticks: { font: { size: 14 } },
                        grid: { color: 'rgba(0, 0, 0, 0.1)' }
                    },
                    y: {
                        title: { display: true, text: 'Rating / Solved Count', font: { size: 16, weight: 'bold' } },
                        ticks: { font: { size: 14 } },
                        grid: { color: 'rgba(0, 0, 0, 0.1)' }
                    }
                },
                plugins: {
                    legend: { labels: { font: { size: 14 } } },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        titleColor: '#000000',
                        bodyColor: '#000000',
                        borderColor: '#000000',
                        borderWidth: 1
                    },
                    zoom: {
                        limits: { x: { min: 'original', max: 'original' }, y: { min: 'original', max: 'original' } },
                        zoom: {
                            wheel: { enabled: true, speed: 0.1 },
                            pinch: { enabled: true },
                            mode: 'xy',
                            onZoomStart: () => console.log("Zoom started"),
                            onZoom: ({ chart }) => updateCursor(chart),
                            onZoomComplete: ({ chart }) => {
                                console.log("Zoom completed");
                                updateCursor(chart);
                            }
                        },
                        pan: {
                            enabled: true,
                            mode: 'xy',
                            threshold: 5,
                            onPanStart: () => {
                                console.log("Pan started");
                                canvas.style.cursor = 'grabbing';
                            },
                            onPan: ({ chart }) => {
                                console.log("Panning:", chart.scales.x.min, chart.scales.x.max);
                            },
                            onPanComplete: ({ chart }) => {
                                console.log("Pan completed:", chart.scales.x.min, chart.scales.x.max);
                                updateCursor(chart);
                            }
                        }
                    }
                }
            }
        });

        chart.resetZoom = function() {
            Chart.prototype.resetZoom.call(this);
            canvas.style.cursor = 'default';
            console.log("Zoom reset");
        };

        console.log("Chart initialized");

        // WebSocket handlers
        ws.onopen = () => console.log(`WebSocket connected for ${username}`);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("Received WebSocket data:", data);

            if (!data || !data.rating_history) {
                console.warn("No valid data received for chart");
                return;
            }

            if (lastData && JSON.stringify(data) !== JSON.stringify(lastData)) {
                showNotification("Data updated!");
            }
            lastData = data;

            updateStats(data, username, compareUsername);
            updateChart(data);
        };

        ws.onclose = () => console.log(`WebSocket disconnected for ${username}`);

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            showNotification("WebSocket error occurred.");
        };

        function showNotification(message) {
            const notification = document.getElementById("notification");
            notification.textContent = message;
            notification.style.display = "block";
            setTimeout(() => notification.style.display = "none", 3000);
        }

        function updateStats(data, username, compareUsername) {
            document.getElementById("codeforces-rating").textContent = data.codeforces_rating !== "N/A" ? data.codeforces_rating : "N/A";
            document.getElementById("leetcode-solved").textContent = data.leetcode_solved || "N/A";
            document.getElementById("codechef-rating").textContent = data.codechef_rating !== "N/A" ? data.codechef_rating : "N/A";

            const historyBody = document.getElementById("history-body");
            const noHistory = document.getElementById("no-history");
            const historySection = document.getElementById("history-section");
            historyBody.innerHTML = "";
            if (noHistory) noHistory.remove();

            if (data.rating_history && data.rating_history.length > 0) {
                data.rating_history.forEach(entry => {
                    const row = document.createElement("tr");
                    row.innerHTML = `
                        <td>${username}</td>
                        <td>${entry.platform || "N/A"}</td>
                        <td>${entry.contest || "N/A"}</td>
                        <td>${entry.rank || "N/A"}</td>
                        <td>${entry.old_rating || "N/A"}</td>
                        <td>${entry.new_rating || "N/A"}</td>
                        <td>${entry.change || "N/A"}</td>
                        <td>${entry.date ? entry.date.slice(0, 10) : "N/A"}</td>
                    `;
                    historyBody.appendChild(row);
                });
            }

            if (data.compare_rating_history && data.compare_rating_history.length > 0) {
                data.compare_rating_history.forEach(entry => {
                    const row = document.createElement("tr");
                    row.classList.add("compare-row");
                    row.innerHTML = `
                        <td>${compareUsername}</td>
                        <td>${entry.platform || "N/A"}</td>
                        <td>${entry.contest || "N/A"}</td>
                        <td>${entry.rank || "N/A"}</td>
                        <td>${entry.old_rating || "N/A"}</td>
                        <td>${entry.new_rating || "N/A"}</td>
                        <td>${entry.change || "N/A"}</td>
                        <td>${entry.date ? entry.date.slice(0, 10) : "N/A"}</td>
                    `;
                    historyBody.appendChild(row);
                });
            }

            if (!data.rating_history && !data.compare_rating_history) {
                const noHistoryMsg = document.createElement("p");
                noHistoryMsg.id = "no-history";
                noHistoryMsg.className = "no-data";
                noHistoryMsg.textContent = "No contest history available.";
                historySection.appendChild(noHistoryMsg);
            }

            if (compareUsername && data.compare_rating_history) {
                const compareCodeforces = data.compare_rating_history
                    .filter(h => h.platform === "Codeforces")
                    .slice(-1)[0]?.new_rating || "N/A";
                const compareCodechef = data.compare_rating_history
                    .filter(h => h.platform === "Codechef")
                    .slice(-1)[0]?.new_rating || "N/A";
                const compareLeetcode = data.compare_rating_history
                    .filter(h => h.platform === "Leetcode")
                    .slice(-1)[0]?.new_rating || data.leetcode_solved_compare || "N/A";

                document.getElementById("compare-username").textContent = compareUsername;
                document.getElementById("compare-codeforces-rating").textContent = compareCodeforces;
                document.getElementById("compare-leetcode-solved").textContent = compareLeetcode;
                document.getElementById("compare-codechef-rating").textContent = compareCodechef;
                document.getElementById("compare-section").style.display = "block";
            } else {
                document.getElementById("compare-section").style.display = "none";
            }
        }

        function updateChart(data) {
            if (!data.rating_history || data.rating_history.length === 0) {
                console.warn("No rating history to display in chart");
                chart.data.datasets = [];
                chart.update();
                return;
            }

            const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
            const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
            const darkModeTextColor = '#ffffff';

            chart.data.datasets = [
                {
                    label: `${username} - Codeforces`,
                    data: data.rating_history.filter(h => h.platform === "Codeforces").map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0 })),
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.2)',
                    fill: false,
                    tension: 0.1
                },
                {
                    label: `${username} - CodeChef`,
                    data: data.rating_history.filter(h => h.platform === "Codechef").map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0 })),
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.2)',
                    fill: false,
                    tension: 0.1
                },
                {
                    label: `${username} - LeetCode`,
                    data: data.rating_history.filter(h => h.platform === "Leetcode").map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0 })),
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    fill: false,
                    tension: 0.1
                },
                {
                    label: `${compareUsername || 'Compare'} - Codeforces`,
                    data: data.compare_rating_history ? data.compare_rating_history.filter(h => h.platform === "Codeforces").map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0 })) : [],
                    borderColor: '#f1c40f',
                    backgroundColor: 'rgba(241, 196, 15, 0.2)',
                    fill: false,
                    tension: 0.1,
                    hidden: !compareUsername
                },
                {
                    label: `${compareUsername || 'Compare'} - CodeChef`,
                    data: data.compare_rating_history ? data.compare_rating_history.filter(h => h.platform === "Codechef").map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0 })) : [],
                    borderColor: '#9b59b6',
                    backgroundColor: 'rgba(155, 89, 182, 0.2)',
                    fill: false,
                    tension: 0.1,
                    hidden: !compareUsername
                },
                {
                    label: `${compareUsername || 'Compare'} - LeetCode`,
                    data: data.compare_rating_history ? data.compare_rating_history.filter(h => h.platform === "Leetcode").map(h => ({ x: new Date(h.date).getTime(), y: h.new_rating || 0 })) : [],
                    borderColor: '#e67e22',
                    backgroundColor: 'rgba(230, 126, 34, 0.2)',
                    fill: false,
                    tension: 0.1,
                    hidden: !compareUsername
                }
            ];

            chart.options.scales.x.title.color = isDarkMode ? darkModeTextColor : textColor;
            chart.options.scales.x.ticks.color = isDarkMode ? darkModeTextColor : textColor;
            chart.options.scales.x.grid.color = isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
            chart.options.scales.y.title.color = isDarkMode ? darkModeTextColor : textColor;
            chart.options.scales.y.ticks.color = isDarkMode ? darkModeTextColor : textColor;
            chart.options.scales.y.grid.color = isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
            chart.options.plugins.legend.labels.color = isDarkMode ? darkModeTextColor : textColor;
            chart.options.plugins.tooltip.backgroundColor = isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)';
            chart.options.plugins.tooltip.titleColor = isDarkMode ? '#ffffff' : '#000000';
            chart.options.plugins.tooltip.bodyColor = isDarkMode ? '#ffffff' : '#000000';
            chart.options.plugins.tooltip.borderColor = isDarkMode ? '#ffffff' : '#000000';

            chart.update();
            updateCursor(chart);
            console.log("Chart updated with datasets:", chart.data.datasets);
            console.log("Canvas after update:", canvas.width, canvas.height);
        }

        function updateCursor(chart) {
            const xScale = chart.scales.x;
            const dataPoints = chart.data.datasets.flatMap(d => d.data.map(p => p.x));
            if (dataPoints.length === 0) {
                canvas.style.cursor = 'default';
                console.log("No data points, cursor set to default");
                return;
            }
            const minX = Math.min(...dataPoints);
            const maxX = Math.max(...dataPoints);
            const isZoomed = xScale.min !== minX || xScale.max !== maxX;
            canvas.style.cursor = isZoomed ? 'grab' : 'default';
            console.log("Cursor update - Zoomed:", isZoomed, "Current X:", xScale.min, xScale.max, "Data X:", minX, maxX);
        }

        // Event Listeners
        document.getElementById("compare-form").addEventListener("submit", (event) => {
            event.preventDefault();
            compareUsername = document.getElementById("compare_username").value.trim();
            if (compareUsername) {
                ws.send(JSON.stringify({ "compare_to": compareUsername }));
            } else {
                showNotification("Please enter a username to compare.");
            }
        });

        document.getElementById("clear-comparison").addEventListener("click", () => {
            compareUsername = null;
            document.getElementById("compare_username").value = "";
            ws.send(JSON.stringify({ "compare_to": null }));
            document.getElementById("compare-section").style.display = "none";
            const historyBody = document.getElementById("history-body");
            const compareRows = historyBody.querySelectorAll(".compare-row");
            compareRows.forEach(row => row.remove());
            if (lastData) {
                const resetData = { ...lastData, compare_rating_history: [], leetcode_solved_compare: 0 };
                updateChart(resetData);
                updateStats(resetData, username, null);
                chart.resetZoom();
            }
        });

        // Theme observer
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'data-theme' && lastData) {
                    console.log("Theme changed detected");
                    updateChart(lastData);
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });
    });
});