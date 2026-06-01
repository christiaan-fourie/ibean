'use client';

import { useDashboardSession } from '../components/DashboardSessionContext';
import { useDashboardOverviewData } from '../hooks/useDashboardOverviewData';

export default function DashboardHome() {
  const { staffAuth } = useDashboardSession();
  const { isLoading, summaryCards, recentSales, recentRefunds } = useDashboardOverviewData();

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
                      <span className="text-neutral-300">{sale.id}</span>
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
