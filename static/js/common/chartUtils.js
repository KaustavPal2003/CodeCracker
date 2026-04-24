// static/js/common/chartUtils.js
/**
 * Upgraded chartUtils — shared by performance/ and compare/ pages.
 *
 * NEW: Per-platform toggle buttons (show/hide CF / LC / CC / AtCoder lines).
 *      Call renderPlatformToggles(chart, containerId) after creating the chart.
 */

const PLATFORM_COLORS = {
  Codeforces: { line: '#6366f1', bg: 'rgba(99,102,241,.12)' },
  LeetCode:   { line: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  CodeChef:   { line: '#10b981', bg: 'rgba(16,185,129,.12)'  },
  AtCoder:    { line: '#ec4899', bg: 'rgba(236,72,153,.12)'  },
};

export function getChartColors() {
  const dark = document.body.classList.contains('dark-theme');
  return {
    text:    dark ? '#d4d8f5' : '#1e1b4b',
    grid:    dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)',
    bg:      dark ? '#141328' : '#ffffff',
    tooltip: dark ? '#1b1a34' : '#ffffff',
  };
}

function processRatingData(ratingHistory, platform) {
  if (!Array.isArray(ratingHistory)) return [];
  return ratingHistory
    .filter(h => h?.platform?.toLowerCase() === platform.toLowerCase())
    .map(h => ({
      x:       new Date(h.date).getTime(),
      y:       h.new_rating || 0,
      contest: h.contest,
      rank:    h.rank,
      change:  h.change,
    }))
    .filter(d => !isNaN(d.x) && !isNaN(d.y) && d.y > 0)
    .sort((a, b) => a.x - b.x);
}

export function updateChart(userData, compareData, username, compareUsername) {
  const ctx = document.getElementById('ratingChart')?.getContext('2d');
  if (!ctx) return;

  const colors = getChartColors();
  if (window.chart) window.chart.destroy();

  const datasets = [];
  const platforms = Object.keys(PLATFORM_COLORS);

  // User 1 datasets
  for (const platform of platforms) {
    const data = processRatingData(userData?.rating_history, platform);
    if (!data.length) continue;
    const pc = PLATFORM_COLORS[platform];
    datasets.push({
      label:           `${username} · ${platform}`,
      data,
      borderColor:     pc.line,
      backgroundColor: pc.bg,
      pointBackgroundColor: pc.line,
      fill:       false,
      tension:    0.35,
      pointRadius: 4,
      pointHoverRadius: 7,
      borderWidth: 2,
      _platform:  platform,
      _user:      'user1',
    });
  }

  // User 2 datasets (compare mode)
  if (compareData?.rating_history) {
    for (const platform of platforms) {
      const data = processRatingData(compareData.rating_history, platform);
      if (!data.length) continue;
      const pc = PLATFORM_COLORS[platform];
      datasets.push({
        label:           `${compareUsername} · ${platform}`,
        data,
        borderColor:     pc.line,
        backgroundColor: pc.bg,
        pointBackgroundColor: pc.line,
        fill:       false,
        tension:    0.35,
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2,
        borderDash: [5, 3],   // dashed = user2
        _platform:  platform,
        _user:      'user2',
      });
    }
  }

  if (!datasets.length) {
    const msg = document.getElementById('no-data-message-chart');
    if (msg) msg.style.display = 'block';
    return;
  }

  const allX = datasets.flatMap(ds => ds.data.map(d => d.x));
  const allY = datasets.flatMap(ds => ds.data.map(d => d.y));
  const [minX, maxX] = [Math.min(...allX), Math.max(...allX)];
  const [minY, maxY] = [Math.min(...allY), Math.max(...allY)];
  const xPad = (maxX - minX) * 0.05 || 86400000;
  const yPad = (maxY - minY) * 0.1  || 50;

  window.chart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'month', displayFormats: { month: 'MMM YY' } },
          min:  minX - xPad, max: maxX + xPad,
          ticks: { color: colors.text, maxTicksLimit: 10 },
          grid:  { color: colors.grid },
          title: { display: true, text: 'Date', color: colors.text },
        },
        y: {
          min:  Math.max(0, minY - yPad), max: maxY + yPad,
          ticks: { color: colors.text },
          grid:  { color: colors.grid },
          title: { display: true, text: 'Rating', color: colors.text },
        },
      },
      plugins: {
        zoom: { pan: { enabled: true, mode: 'xy' }, zoom: { wheel: { enabled: true }, mode: 'xy' } },
        legend: { display: false },   // We render our own toggle buttons
        tooltip: {
          backgroundColor: colors.tooltip,
          titleColor: colors.text, bodyColor: colors.text,
          borderColor: colors.grid, borderWidth: 1,
          callbacks: {
            label: ctx => {
              const r = ctx.raw;
              const change = r.change ? (r.change > 0 ? ` (+${r.change})` : ` (${r.change})`) : '';
              return `${ctx.dataset.label}: ${r.y}${change}  Rank: ${r.rank || '—'}`;
            },
            afterBody: ctx => ctx[0]?.raw?.contest ? [`Contest: ${ctx[0].raw.contest}`] : [],
          },
        },
      },
    },
  });

  // Zoom-to-fit / reset buttons
  const btnZoom  = document.getElementById('zoom-to-fit');
  const btnReset = document.getElementById('reset-zoom');
  if (btnZoom)  { btnZoom.style.display  = 'inline-flex'; btnZoom.onclick  = () => window.chart.resetZoom(); }
  if (btnReset) { btnReset.style.display = 'inline-flex'; btnReset.onclick = () => window.chart.resetZoom(); }

  return window.chart;
}

/**
 * Render per-platform toggle pill buttons.
 * Call this AFTER updateChart().
 * @param {Chart} chart  The Chart.js instance (window.chart)
 * @param {string} containerId  ID of the element to inject buttons into
 */
export function renderPlatformToggles(chart, containerId = 'platform-toggles') {
  const container = document.getElementById(containerId);
  if (!container || !chart) return;
  container.innerHTML = '';

  // Collect unique platforms in this chart
  const seen = new Set();
  chart.data.datasets.forEach(ds => {
    if (!seen.has(ds._platform)) seen.add(ds._platform);
  });

  seen.forEach(platform => {
    const pc  = PLATFORM_COLORS[platform];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'platform-toggle-btn active';
    btn.dataset.platform = platform;
    btn.style.setProperty('--pt-color', pc.line);
    btn.innerHTML =
      `<span class="pt-dot"></span>${platform}`;

    btn.addEventListener('click', () => {
      const active = btn.classList.toggle('active');
      chart.data.datasets.forEach((ds, i) => {
        if (ds._platform === platform) {
          chart.setDatasetVisibility(i, active);
        }
      });
      chart.update();
    });

    container.appendChild(btn);
  });
}

export function updateChartColors(chart) {
  if (!chart) return;
  const c = getChartColors();
  chart.options.scales.x.ticks.color = c.text;
  chart.options.scales.y.ticks.color = c.text;
  chart.options.scales.x.grid.color  = c.grid;
  chart.options.scales.y.grid.color  = c.grid;
  chart.options.plugins.tooltip.backgroundColor = c.tooltip;
  chart.options.plugins.tooltip.titleColor = c.text;
  chart.options.plugins.tooltip.bodyColor  = c.text;
  chart.canvas.style.backgroundColor = c.bg;
  chart.update();
}
