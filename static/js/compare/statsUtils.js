// statsUtils.js
function updateStats(data, user1Username, user2Username) {
    console.log('Updating stats with:', { data, user1Username, user2Username });

    document.getElementById('user1-username').textContent = user1Username;
    document.getElementById('codeforces-rating').textContent = data.codeforces_rating !== undefined ? data.codeforces_rating : 'N/A';
    document.getElementById('leetcode-solved').textContent = data.leetcode_solved || 0;
    document.getElementById('codechef-rating').textContent = data.codechef_rating !== undefined ? data.codechef_rating : 'N/A';

    const historyBody = document.getElementById('history-body');
    const noHistory = document.getElementById('no-history');
    const historySection = document.getElementById('history-section');
    historyBody.innerHTML = '';
    if (noHistory) noHistory.remove();

    if (data.rating_history && data.rating_history.length > 0) {
        data.rating_history.forEach(entry => {
            if (entry && entry.platform) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user1Username}</td>
                    <td>${entry.platform}</td>
                    <td>${entry.contest || 'N/A'}</td>
                    <td>${entry.rank || 'N/A'}</td>
                    <td>${entry.old_rating !== undefined ? entry.old_rating : 'N/A'}</td>
                    <td>${entry.new_rating !== undefined ? entry.new_rating : 'N/A'}</td>
                    <td>${entry.change !== undefined ? entry.change : 'N/A'}</td>
                    <td>${entry.date ? entry.date.slice(0, 10) : 'N/A'}</td>
                `;
                historyBody.appendChild(row);
            }
        });
    }

    if (user2Username && data.compare_rating_history && data.compare_rating_history.length > 0) {
        data.compare_rating_history.forEach(entry => {
            if (entry && entry.platform) {
                const row = document.createElement('tr');
                row.classList.add('compare-row');
                row.innerHTML = `
                    <td>${user2Username}</td>
                    <td>${entry.platform}</td>
                    <td>${entry.contest || 'N/A'}</td>
                    <td>${entry.rank || 'N/A'}</td>
                    <td>${entry.old_rating !== undefined ? entry.old_rating : 'N/A'}</td>
                    <td>${entry.new_rating !== undefined ? entry.new_rating : 'N/A'}</td>
                    <td>${entry.change !== undefined ? entry.change : 'N/A'}</td>
                    <td>${entry.date ? entry.date.slice(0, 10) : 'N/A'}</td>
                `;
                historyBody.appendChild(row);
            }
        });
    }

    if ((!data.rating_history || data.rating_history.length === 0) &&
        (!data.compare_rating_history || data.compare_rating_history.length === 0)) {
        const noHistoryMsg = document.createElement('p');
        noHistoryMsg.id = 'no-history';
        noHistoryMsg.className = 'no-data';
        noHistoryMsg.textContent = 'No contest history available.';
        historySection.appendChild(noHistoryMsg);
    }

    if (user2Username) {
        const compareCodeforces = data.compare_rating_history && data.compare_rating_history.length > 0 ?
            (data.compare_rating_history.filter(h => h && h.platform === 'Codeforces').slice(-1)[0]?.new_rating || 'N/A') : 'N/A';
        const compareCodechef = data.compare_rating_history && data.compare_rating_history.length > 0 ?
            (data.compare_rating_history.filter(h => h && h.platform === 'Codechef').slice(-1)[0]?.new_rating || 'N/A') : 'N/A';
        const compareLeetcode = data.leetcode_solved_compare || 0;

        document.getElementById('compare-username').textContent = user2Username;
        document.getElementById('compare-codeforces-rating').textContent = compareCodeforces;
        document.getElementById('compare-leetcode-solved').textContent = compareLeetcode;
        document.getElementById('compare-codechef-rating').textContent = compareCodechef;
        document.getElementById('compare-section').style.display = 'block';
    } else {
        document.getElementById('compare-section').style.display = 'none';
    }

    const existingAvg = document.getElementById('avg-rating-change');
    if (existingAvg) existingAvg.remove();
    if (data.rating_history && data.rating_history.length > 0) {
        const avgChange = data.rating_history.reduce((sum, h) => sum + (h.change || 0), 0) / data.rating_history.length;
        document.getElementById('stats-container').insertAdjacentHTML('beforeend',
            `<p id="avg-rating-change">Average Rating Change (${user1Username}): <span class="stat-value">${avgChange.toFixed(2)}</span></p>`
        );
    }
}