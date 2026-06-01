'use client';

import { useDashboardSession } from '../components/DashboardSessionContext';
import { useDashboardOverviewData } from '../hooks/useDashboardOverviewData';

export default function DashboardHome() {
  const { staffAuth } = useDashboardSession();
  const { isLoading, summaryCards, recentSales, recentRefunds } = useDashboardOverviewData();
  const formatSaleDate = (sale) => {
    const dateValue = sale?.date || sale?.timestamp || sale?.createdAt;
    let date = null;

    if (dateValue?.toDate) {
      date = dateValue.toDate();
    } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      date = new Date(dateValue);
    }

    if (!date || Number.isNaN(date.getTime())) return 'Date unavailable';
    return date.toLocaleString();
  };

  const formatMoney = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount) ? `R ${amount.toFixed(2)}` : 'R 0.00';
  };
  const countMap = Object.fromEntries(summaryCards.map((card) => [card.label, card.value]));
  const activityData = [
    { label: 'Sales', value: countMap['Sales Records'] || 0, tone: 'bg-emerald-500' },
    { label: 'Refunds', value: countMap['Refunds'] || 0, tone: 'bg-rose-500' },
    { label: 'Vouchers', value: countMap['Vouchers'] || 0, tone: 'bg-sky-500' },
    { label: 'Specials', value: countMap['Active Specials'] || 0, tone: 'bg-amber-500' }
  ];
  const maxActivity = Math.max(...activityData.map((item) => item.value), 1);
  const salesTrend = [...recentSales].reverse().map((sale) => Number(sale.total) || 0);
  const maxTrend = Math.max(...salesTrend, 1);
  const trendPoints = salesTrend
    .map((value, index) => {
      const x = salesTrend.length === 1 ? 0 : (index / (salesTrend.length - 1)) * 100;
      const y = 100 - (value / maxTrend) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="h-full p-4 bg-neutral-900 text-neutral-100 overflow-y-auto">
      <div className="mb-4 rounded-md border border-neutral-700 bg-neutral-800 p-4">
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-6 w-52 rounded bg-neutral-700" />
            <div className="h-4 w-40 rounded bg-neutral-700" />
          </div>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Dashboard Overview</h1>
            <p className="mt-1 text-sm text-neutral-400">
              {staffAuth
                ? `${staffAuth.staffName} (${staffAuth.accountType})`
                : 'Store snapshot'}
            </p>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`summary-skeleton-${index}`}
                className="rounded-md border border-neutral-700 bg-neutral-800 p-4 animate-pulse"
              >
                <div className="h-3 w-24 rounded bg-neutral-700" />
                <div className="mt-3 h-8 w-14 rounded bg-neutral-700" />
              </div>
            ))
          : summaryCards.map((card) => (
              <div key={card.label} className="rounded-md border border-neutral-700 bg-neutral-800 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-400">{card.label}</p>
                <p className="mt-2 text-2xl font-bold">{card.value}</p>
              </div>
            ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section className="rounded-md border border-neutral-700 bg-neutral-800 p-4">
          <h2 className="text-sm font-semibold">Activity Snapshot</h2>
          <div className="mt-3 space-y-2">
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div key={`activity-skeleton-${index}`} className="animate-pulse">
                    <div className="mb-1 h-3 w-16 rounded bg-neutral-700" />
                    <div className="h-2.5 w-full rounded bg-neutral-700" />
                  </div>
                ))
              : activityData.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-neutral-300">{item.label}</span>
                      <span className="font-medium text-white">{item.value}</span>
                    </div>
                    <div className="h-2.5 rounded bg-neutral-700">
                      <div
                        className={`h-2.5 rounded ${item.tone}`}
                        style={{ width: `${Math.max((item.value / maxActivity) * 100, item.value > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
          </div>
        </section>

        <section className="rounded-md border border-neutral-700 bg-neutral-800 p-4">
          <h2 className="text-sm font-semibold">Sales Trend (Recent)</h2>
          {isLoading ? (
            <div className="mt-3 h-28 animate-pulse rounded bg-neutral-700" />
          ) : salesTrend.length > 1 ? (
            <div className="mt-3">
              <svg viewBox="0 0 100 100" className="h-28 w-full">
                <polyline
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="3"
                  points={trendPoints}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
                <span>Older</span>
                <span>Latest</span>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-400">Not enough sales data for a trend line yet.</p>
          )}
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section className="rounded-md border border-neutral-700 bg-neutral-800 p-4">
          <h2 className="text-sm font-semibold">Recent Sales</h2>
          <ul className="mt-2 space-y-2">
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <li
                    key={`sales-skeleton-${index}`}
                    className="rounded bg-neutral-700 px-3 py-2 animate-pulse"
                  >
                    <div className="h-4 w-32 rounded bg-neutral-600" />
                  </li>
                ))
              : (
                <>
                  {recentSales.length === 0 && <li className="text-sm text-neutral-400">No sales yet.</li>}
                  {recentSales.map((sale) => (
                    <li key={sale.id} className="rounded bg-neutral-700 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-neutral-100">{formatMoney(sale.total)}</span>
                        <span className="text-xs capitalize text-neutral-300">
                          {sale.payment?.method?.replace('_', ' ') || 'Unknown payment'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-neutral-400">
                        <span>{Array.isArray(sale.items) ? sale.items.length : 0} items</span>
                        <span>{formatSaleDate(sale)}</span>
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        Staff: {sale.staffName || sale.createdBy?.name || 'Unknown'}
                      </div>
                    </li>
                  ))}
                </>
              )}
          </ul>
        </section>

        <section className="rounded-md border border-neutral-700 bg-neutral-800 p-4">
          <h2 className="text-sm font-semibold">Recent Refunds</h2>
          <ul className="mt-2 space-y-2">
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <li
                    key={`refunds-skeleton-${index}`}
                    className="rounded bg-neutral-700 px-3 py-2 animate-pulse"
                  >
                    <div className="h-4 w-32 rounded bg-neutral-600" />
                  </li>
                ))
              : (
                <>
                  {recentRefunds.length === 0 && <li className="text-sm text-neutral-400">No refunds yet.</li>}
                  {recentRefunds.map((refund) => (
                    <li key={refund.id} className="rounded bg-neutral-700 px-3 py-2 text-sm">
                      <span className="text-neutral-300">{refund.id}</span>
                    </li>
                  ))}
                </>
              )}
          </ul>
        </section>
      </div>
    </div>
  );
}
