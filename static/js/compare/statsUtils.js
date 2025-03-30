// statsUtils.js
function updateStats(data, user1Username, user2Username) {
    console.log('Updating stats with:', { data, user1Username, user2Username });

    // DOM elements
    const statsContainer = document.getElementById('stats-container');
    const user1Stats = document.getElementById('user1-stats');
    const noRatingsMessage = document.getElementById('no-ratings-message');
    const historyBody = document.getElementById('history-body');
    const noHistory = document.getElementById('no-history');
    const historySection = document.getElementById('history-section');

    if (!statsContainer || !user1Stats || !noRatingsMessage || !historyBody || !historySection) {
        console.error('Required DOM elements are missing');
        return;
    }

    historyBody.innerHTML = '';
    if (noHistory) noHistory.remove();

    const user1UsernameEl = document.getElementById('user1-username');
    const codeforcesRatingEl = document.getElementById('codeforces-rating');
    const leetcodeSolvedEl = document.getElementById('leetcode-solved');
    const codechefRatingEl = document.getElementById('codechef-rating');

    // Handle cases where there's no rating data
    if (data.has_no_ratings && user1Username === document.getElementById('username-data').dataset.username) {
        user1Stats.style.display = 'none';
        noRatingsMessage.textContent = `No rating data available for ${user1Username}.`;
        noRatingsMessage.style.display = 'block';
        document.getElementById('compare-section').style.display = 'none';
    } else {
        user1Stats.style.display = 'block';
        noRatingsMessage.style.display = 'none';

        if (user1UsernameEl) user1UsernameEl.textContent = user1Username;
        if (codeforcesRatingEl) codeforcesRatingEl.textContent = data.codeforces_rating !== undefined ? data.codeforces_rating : 'N/A';
        if (leetcodeSolvedEl) leetcodeSolvedEl.textContent = data.leetcode_solved || 0;
        if (codechefRatingEl) codechefRatingEl.textContent = data.codechef_rating !== undefined ? data.codechef_rating : 'N/A';

        // Add rating history for user1
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

            // Calculate and display average rating change
            const avgChange = data.rating_history.reduce((sum, h) => sum + (h.change || 0), 0) / data.rating_history.length;
            const existingAvg = document.getElementById('avg-rating-change');
            if (existingAvg) existingAvg.remove();
            user1Stats.insertAdjacentHTML('beforeend',
                `<p id="avg-rating-change">Average Rating Change (${user1Username}): <span class="stat-value">${avgChange.toFixed(2)}</span></p>`
            );
        }
    }

    // Handle comparison data if user2 is present
    if (user2Username) {
        const compareCodeforces = data.compare_rating_history && data.compare_rating_history.length > 0 ?
            (data.compare_rating_history.filter(h => h && h.platform === 'Codeforces').slice(-1)[0]?.new_rating || 'N/A') : 'N/A';
        const compareCodechef = data.compare_rating_history && data.compare_rating_history.length > 0 ?
            (data.compare_rating_history.filter(h => h && h.platform === 'Codechef').slice(-1)[0]?.new_rating || 'N/A') : 'N/A';
        const compareLeetcode = data.leetcode_solved_compare || 0;

        const compareUsernameEl = document.getElementById('compare-username');
        const compareCodeforcesEl = document.getElementById('compare-codeforces-rating');
        const compareLeetcodeEl = document.getElementById('compare-leetcode-solved');
        const compareCodechefEl = document.getElementById('compare-codechef-rating');

        if (compareUsernameEl) compareUsernameEl.textContent = user2Username;
        if (compareCodeforcesEl) compareCodeforcesEl.textContent = compareCodeforces;
        if (compareLeetcodeEl) compareLeetcodeEl.textContent = compareLeetcode;
        if (compareCodechefEl) compareCodechefEl.textContent = compareCodechef;
        document.getElementById('compare-section').style.display = 'block';

        // Add rating history for user2
        if (data.compare_rating_history && data.compare_rating_history.length > 0) {
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
    } else {
        document.getElementById('compare-section').style.display = 'none';
    }

    // Handle case when no contest history is available
    if ((!data.rating_history || data.rating_history.length === 0) &&
        (!data.compare_rating_history || data.compare_rating_history.length === 0)) {
        const noHistoryMsg = document.createElement('p');
        noHistoryMsg.id = 'no-history';
        noHistoryMsg.className = 'no-data';
        noHistoryMsg.textContent = 'No contest history available.';
        historySection.appendChild(noHistoryMsg);
    }
}
