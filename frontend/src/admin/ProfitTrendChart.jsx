import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatCurrency, formatCurrencyCompact } from '../utils/format';
import '../css/admin.css';

// ARCHITECTURE_REVIEW.md item 49 (REDESIGN-v2.md's dashboard v2) — the Admin dashboard's new
// profit-trend widget, backed by item 48's GET /api/dashboard/profit-trend (6 Manila calendar
// months, oldest first, ₱0 for a month with no recorded profit). A hand-drawn bar chart, per the
// brief — no charting library styling is assumed.

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym) => MONTH_NAMES[Number(ym.slice(5, 7)) - 1];
const monthYear = (ym) => `${monthLabel(ym)} ${ym.slice(0, 4)}`;

// Mirrors DashboardV2.dc.html's own `nice()` helper — rounds a chart max up to a "nice" tick
// (1/1.5/2/2.5/5/10 × a power of 10) instead of the raw data max, so the y-axis reads cleanly.
const niceCeil = (m) => {
  if (m <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(m)));
  const f = m / exp;
  const mult = f <= 1 ? 1 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return mult * exp;
};

const PLOT_HEIGHT = 210;

const ProfitTrendChart = () => {
  const [trend, setTrend] = useState(null); // null while the first fetch is in flight
  const [error, setError] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const { data } = await api.get('/api/dashboard/profit-trend');
        if (!ignore) setTrend(data || []);
      } catch (err) {
        console.error('Error fetching profit trend:', err.message);
        if (!ignore) setError(true);
      }
    })();
    return () => { ignore = true; };
  }, []);

  const loading = trend === null && !error;
  const hasData = Array.isArray(trend) && trend.length > 0;
  const allZero = hasData && trend.every((row) => row.netProfit === 0);
  const showChart = hasData && !allZero;

  let subtitle = '';
  let total = 0;
  let bars = [];
  let yLabels = [];

  if (showChart) {
    total = trend.reduce((sum, row) => sum + row.netProfit, 0);
    subtitle = `Net profit, ${monthLabel(trend[0].month)} to ${monthYear(trend[trend.length - 1].month)}`;

    const values = trend.map((row) => row.netProfit);
    // The brief requires a negative month to render sensibly, not just the common all-positive
    // case — the scale spans niceMin..niceMax with an explicit zero line, and a negative bar
    // grows down from it rather than up from the plot's bottom edge.
    const hasNegative = values.some((v) => v < 0);
    const niceMax = niceCeil(Math.max(...values, 0));
    const niceMin = hasNegative ? -niceCeil(Math.abs(Math.min(...values, 0))) : 0;
    const range = niceMax - niceMin;
    const zeroY = range > 0 ? (niceMax / range) * PLOT_HEIGHT : PLOT_HEIGHT;

    bars = trend.map((row, i) => {
      const v = row.netProfit;
      const isCurrent = i === trend.length - 1;
      let top, height;
      if (v === 0) {
        // A zero month gets a 2px stub at the zero line rather than vanishing entirely.
        top = zeroY - 2;
        height = 2;
      } else if (v > 0) {
        height = niceMax > 0 ? (v / niceMax) * zeroY : 0;
        top = zeroY - height;
      } else {
        height = niceMin < 0 ? (Math.abs(v) / Math.abs(niceMin)) * (PLOT_HEIGHT - zeroY) : 0;
        top = zeroY;
      }
      return {
        key: row.month,
        label: formatCurrencyCompact(v),
        top,
        height,
        negative: v < 0,
        zero: v === 0,
        isCurrent,
        monthShort: monthLabel(row.month),
      };
    });

    yLabels = hasNegative
      ? [formatCurrencyCompact(niceMax), '₱0', formatCurrencyCompact(niceMin)]
      : [formatCurrencyCompact(niceMax), formatCurrencyCompact(niceMax / 2), '₱0'];
  }

  return (
    <div className="wb-panel ptc-panel">
      <div className="wb-panel__header">
        <div>
          <h2 className="wb-panel__title">Profit trend</h2>
          {showChart && <span className="wb-panel__subtitle">{subtitle}</span>}
        </div>
        {showChart && (
          <div className="ptc-total">
            <span className="ptc-total-label">6-month total</span>
            <span className="ptc-total-value">{formatCurrency(total)}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="wb-panel__body ptc-skeleton" aria-hidden="true">
          <div className="ptc-skeleton-plot">
            {[30, 55, 40, 70, 45, 60].map((h, i) => (
              <span key={i} className="ptc-skeleton-col">
                <span className="wb-skeleton ptc-skeleton-bar" style={{ height: `${h}%` }}></span>
              </span>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="wb-empty">
          <div className="wb-empty__icon"><i className="fa-solid fa-chart-column" aria-hidden="true"></i></div>
          <div className="wb-empty__title">Couldn't load the profit trend.</div>
        </div>
      ) : allZero ? (
        <div className="wb-empty">
          <div className="wb-empty__icon"><i className="fa-solid fa-chart-column" aria-hidden="true"></i></div>
          <div className="wb-empty__title">No profit recorded yet</div>
          <div className="wb-empty__text">Net profit from completed projects will show here by month.</div>
        </div>
      ) : (
        <div className="wb-panel__body ptc-body">
          <div className="ptc-plot-row" aria-hidden="true">
            <div className="ptc-y-axis">
              {yLabels.map((label, i) => <span key={i}>{label}</span>)}
            </div>
            <div className="ptc-plot">
              <span className="ptc-gridline ptc-gridline--top"></span>
              <span className="ptc-gridline ptc-gridline--mid"></span>
              {bars.map((bar) => (
                <div key={bar.key} className="ptc-bar-col">
                  <span
                    className={`ptc-bar${bar.negative ? ' ptc-bar--negative' : ''}${bar.zero ? ' ptc-bar--zero' : ''}`}
                    style={{ top: `${bar.top}px`, height: `${Math.max(bar.height, 0)}px` }}
                  ></span>
                  <span
                    className={`ptc-bar-label${bar.zero ? ' ptc-bar-label--zero' : ''}`}
                    style={{ top: `${bar.top - 16}px`, fontWeight: bar.isCurrent ? 600 : 400 }}
                  >
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="ptc-months" aria-hidden="true">
            {bars.map((bar) => (
              <span key={bar.key} className="ptc-month" style={{ fontWeight: bar.isCurrent ? 600 : 400 }}>
                {bar.monthShort}
              </span>
            ))}
          </div>

          {/* DESIGN.md/REDESIGN-v2.md — a hand-drawn chart needs a real accessible alternative,
              not just aria-hidden decoration above. */}
          <table className="wb-visually-hidden">
            <caption>Net profit by month</caption>
            <thead>
              <tr><th scope="col">Month</th><th scope="col">Net profit</th></tr>
            </thead>
            <tbody>
              {trend.map((row) => (
                <tr key={row.month}>
                  <td>{monthYear(row.month)}</td>
                  <td>{formatCurrency(row.netProfit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProfitTrendChart;
