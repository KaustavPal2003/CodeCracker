function updateHistory(data) {
    const historyBody = document.getElementById("history-body");
    if (!historyBody) {
        console.error("History body element not found!");
        return;
    }
    historyBody.innerHTML = '';

    if (!data || !data.rating_history || !Array.isArray(data.rating_history) || data.rating_history.length === 0) {
        historyBody.innerHTML = '<tr><td colspan="5" class="no-data">No recent contest history available.</td></tr>';
        return;
    }

    const sortedHistory = [...data.rating_history].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedHistory.slice(0, 10).forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(entry.platform || 'Unknown')}</td>
            <td>${escapeHtml(entry.contest || 'Unknown Contest')}</td>
            <td>${moment(new Date(entry.date)).format('MMM D, YYYY')}</td>
            <td>${escapeHtml(String(entry.new_rating || 0))}</td>
            <td>${escapeHtml(String(entry.rank || 'N/A'))}</td>
        `;
        historyBody.appendChild(row);
    });
}