import { showError } from './main.js';

function updateHistoryTable(userData, compareData = null) {
    const tbody = document.getElementById('history-body');
    const historySection = document.getElementById('history-section');

    if (!tbody || !historySection) {
        console.error('History table body or section not found');
        showError('Failed to update history table: Table elements missing');
        return;
    }

    tbody.innerHTML = '';

    const history = userData?.rating_history || [];
    if (!Array.isArray(history) || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No contest history available.</td></tr>';
        historySection.style.display = 'block';
        return;
    }

    // Sort by date, latest first
    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    history.forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.platform || 'N/A'}</td>
            <td>${entry.contest || 'N/A'}</td>
            <td>${entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A'}</td>
            <td>${entry.new_rating ?? 'N/A'}</td>
            <td>${entry.rank || 'N/A'}</td>
        `;
        tbody.appendChild(row);
    });

    historySection.style.display = 'block';
}

export { updateHistoryTable };