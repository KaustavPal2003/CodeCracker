        const username = "{{ user.username }}";
        const ws = new WebSocket(`ws://${window.location.host}/ws/stats/${username}/`);

        ws.onopen = function() {
            console.log("WebSocket connected for", username);
        };

        ws.onmessage = function(event) {
            const message = JSON.parse(event.data);
            console.log("Received:", message);

            if (message.type === "stats_update" && message.data) {
                console.log("Processing stats_update with data:", message.data);
                const data = message.data;

                const cfRating = document.getElementById("cf-rating");
                const lcSolved = document.getElementById("lc-solved");
                const ccRating = document.getElementById("cc-rating");

                if (cfRating) {
                    cfRating.textContent = data.codeforces_rating !== undefined ? data.codeforces_rating : "N/A";
                    console.log("Updated CF rating to:", cfRating.textContent);
                }
                if (lcSolved) {
                    lcSolved.textContent = data.leetcode_solved !== undefined ? data.leetcode_solved : "N/A";
                    console.log("Updated LC solved to:", lcSolved.textContent);
                }
                if (ccRating) {
                    ccRating.textContent = data.codechef_rating !== undefined ? data.codechef_rating : "N/A";
                    console.log("Updated CC rating to:", ccRating.textContent);
                }

                if (data.rating_history && data.rating_history.length > 0) {
                    console.log("Updating contest history with:", data.rating_history);
                    const historyTable = document.getElementById("contest-history");
                    if (historyTable) {
                        historyTable.innerHTML = "";
                        data.rating_history.forEach(entry => {
                            const row = `<tr>
                                <td>${entry.platform || "N/A"}</td>
                                <td>${entry.contest || "N/A"}</td>
                                <td>${entry.new_rating || "N/A"}</td>
                                <td>${entry.date ? new Date(entry.date).toLocaleDateString() : "N/A"}</td>
                            </tr>`;
                            historyTable.innerHTML += row;
                        });
                        console.log("Contest history updated successfully");
                    }
                }
            } else if (message.type === "notification") {
                console.log("Notification received:", message.message);
                const notifDiv = document.getElementById("notifications");
                if (notifDiv) {
                    notifDiv.innerHTML += `<p style="color: green;">${message.message}</p>`;
                    setTimeout(() => notifDiv.innerHTML = "", 5000);
                } else {
                    console.error("Element #notifications not found");
                }
            } else if (message.type === "error") {
                document.getElementById("stats-container").innerHTML += `<p class="error-message">${message.message}</p>`;
            }
        };

        ws.onerror = function(error) {
            console.error("WebSocket error:", error);
        };

        ws.onclose = function() {
            console.log("WebSocket closed");
        };