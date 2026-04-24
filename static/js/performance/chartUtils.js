// static/js/performance/chartUtils.js
// Re-exports from the shared common module so both main.js and websocket.js
// always use the same chart functions regardless of import path.
export { updateChart, renderPlatformToggles, updateChartColors, getChartColors } from '../common/chartUtils.js';
