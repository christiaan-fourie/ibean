'use client';

import { useState } from 'react';
import { useDashboardSession } from '../components/DashboardSessionContext';
import { useDashboardOverviewData } from '../hooks/useDashboardOverviewData';
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const formatMoney = (value) => {
  const amount = Number(value) || 0;
  return `R ${amount.toFixed(2)}`;
};

const formatDateTime = (date) => {
  if (!date || Number.isNaN(date.getTime())) return 'Date unavailable';

  return date.toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const salesChartConfig = {
  sales: {
    label: 'Net sales',
    color: 'hsl(189 94% 43%)',
  },
};

const itemChartConfig = {
  count: {
    label: 'Items sold',
    color: 'hsl(34 92% 55%)',
  },
};

export default function DashboardHome() {
  const [rangePreset, setRangePreset] = useState('today');
  const { user, staffAuth } = useDashboardSession();
  const {
    isLoading,
    summaryCards,
    recentSales,
    recentRefunds,
    selectedTrend,
    scopeLabel,
    paymentMixBreakdown,
    topItemsBreakdown,
  } = useDashboardOverviewData({ user, staffAuth, range: rangePreset });
  const currentScope = staffAuth
    ? `${staffAuth.staffName} · ${staffAuth.accountType}`
    : 'Store snapshot';

  const trendChartData = selectedTrend.map((point) => ({
    day: point.label,
    sales: Number(point.value) || 0,
  }));
  const itemChartData = topItemsBreakdown.map((item) => ({
    item: item.name,
    count: item.quantity,
  }));
  const hasTrendData = trendChartData.some((point) => point.sales > 0);
  const hasItemData = itemChartData.some((point) => point.count > 0);
  const trendTitle = rangePreset === 'today' ? 'Sales rhythm by hour' : 'Sales rhythm by day';
  const trendSubtitle =
    rangePreset === 'today'
      ? 'Sales across today, shown from 08:00 to 20:00.'
      : 'Sales over the selected range, shown day by day.';

  return (
    <div className="h-full overflow-y-auto bg-neutral-900/35 p-2.5 text-neutral-100 md:p-3">
      <div className="mb-3 rounded-[28px] border border-white/10 bg-gradient-to-br from-sky-500/12 via-white/5 to-emerald-500/10 p-3 shadow-xl backdrop-blur-2xl md:p-4">
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-3 w-28 rounded-full bg-white/10" />
            <div className="h-7 w-64 rounded-full bg-white/10" />
            <div className="h-4 w-full max-w-2xl rounded-full bg-white/10" />
            <div className="grid gap-2 sm:grid-cols-2 lg:max-w-xl">
              <div className="h-16 rounded-2xl bg-white/10" />
              <div className="h-16 rounded-2xl bg-white/10" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300/90">Overview</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRangePreset('today')}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    rangePreset === 'today'
                      ? 'border-cyan-300/40 bg-cyan-400/20 text-cyan-100'
                      : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setRangePreset('7d')}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    rangePreset === '7d'
                      ? 'border-cyan-300/40 bg-cyan-400/20 text-cyan-100'
                      : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  7 days
                </button>
                <button
                  type="button"
                  onClick={() => setRangePreset('mtd')}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    rangePreset === 'mtd'
                      ? 'border-cyan-300/40 bg-cyan-400/20 text-cyan-100'
                      : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  Month to date
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[18rem]">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">Scope</p>
                <p className="mt-1 text-sm font-medium text-white">{scopeLabel}</p>
              </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">Session</p>
              <p className="mt-1 text-sm font-medium text-white">{currentScope}</p>
            </div>
          </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`summary-skeleton-${index}`}
                className="rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-lg shadow-black/10 animate-pulse md:p-4"
              >
                <div className="h-3 w-24 rounded-full bg-white/10" />
                <div className="mt-4 h-8 w-20 rounded-full bg-white/10" />
                <div className="mt-3 h-3 w-32 rounded-full bg-white/10" />
              </div>
            ))
          : summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-lg shadow-black/10 backdrop-blur-xl md:p-4"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-400">{card.label}</p>
                <p className="mt-2.5 text-[1.5rem] font-semibold text-white md:text-2xl">{card.value}</p>
                <p className="mt-2 text-xs text-neutral-400">{card.hint}</p>
              </div>
            ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[28px] border border-white/10 bg-neutral-900/60 p-3 shadow-xl backdrop-blur-2xl md:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white md:text-base">{trendTitle}</h2>
              <p className="mt-1 text-[11px] text-neutral-400 md:text-xs">{trendSubtitle}</p>
            </div>
          </div>

          <div className="mt-3 h-52 rounded-[24px] border border-white/10 bg-white/5 p-2.5 md:h-56">
            {isLoading ? (
              <div className="flex h-full items-end gap-3">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div key={`trend-skeleton-${index}`} className="flex-1">
                    <div className="h-32 rounded-t-2xl bg-white/10 animate-pulse md:h-36" />
                    <div className="mt-2 h-3 rounded-full bg-white/10 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : hasTrendData ? (
              <ChartContainer config={salesChartConfig} className="h-full w-full">
                <AreaChart data={trendChartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    stroke="rgba(255,255,255,0.35)"
                    fontSize={11}
                    interval={0}
                  />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <Area
                    dataKey="sales"
                    type="monotone"
                    stroke="var(--color-sales)"
                    fill="var(--color-sales)"
                    fillOpacity={0.18}
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                Not enough sales data yet to show a trend.
              </div>
            )}
          </div>

        </section>

        <section className="rounded-[28px] border border-white/10 bg-neutral-900/60 p-3 shadow-xl backdrop-blur-2xl md:p-4">
          <h2 className="text-sm font-semibold text-white md:text-base">Payment Methods</h2>
          <p className="mt-1 text-[11px] text-neutral-400 md:text-xs">Simple transaction count by payment type.</p>

          <div className="mt-3 space-y-2.5 rounded-[24px] border border-white/10 bg-white/5 p-3 md:p-4">
            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`mix-skeleton-${index}`}>
                    <div className="mb-2 h-3 w-20 rounded-full bg-white/10" />
                    <div className="h-3 rounded-full bg-white/10" />
                  </div>
                ))}
              </div>
            ) : paymentMixBreakdown.length > 0 ? (
              paymentMixBreakdown.map((item) => {
                const totalTransactions = paymentMixBreakdown.reduce((sum, entry) => sum + entry.count, 0) || 1;
                const width = Math.max((item.count / totalTransactions) * 100, item.count > 0 ? 8 : 0);

                return (
                  <div key={item.method}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-neutral-300">{item.method}</span>
                      <span className="font-medium text-white">{item.count}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/10">
                      <div
                        className="h-2.5 rounded-full bg-cyan-400/80"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex h-24 items-center justify-center text-sm text-neutral-400">
                No payment data yet.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="mt-3 rounded-[28px] border border-white/10 bg-neutral-900/60 p-3 shadow-xl backdrop-blur-2xl md:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white md:text-base">Most sold items, last 30 days</h2>
            <p className="mt-1 text-[11px] text-neutral-400 md:text-xs">
              Radar view of the top selling items over the last 30 days. Bigger shape means more volume.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-300">
            {topItemsBreakdown.length > 0 ? `Top 30d item: ${topItemsBreakdown[0].name}` : 'No item data yet'}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="h-64 rounded-[24px] border border-white/10 bg-white/5 p-2.5 md:h-72">
            {isLoading ? (
              <div className="flex h-full items-center justify-center rounded-[20px] bg-white/5 animate-pulse">
                <div className="h-40 w-40 rounded-full border border-white/10 bg-white/10" />
              </div>
            ) : hasItemData ? (
              <ChartContainer config={itemChartConfig} className="h-full w-full aspect-auto">
                <RadarChart data={itemChartData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="item" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.75)', fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} />
                  <Radar
                    dataKey="count"
                    stroke="var(--color-count)"
                    fill="var(--color-count)"
                    fillOpacity={0.22}
                    strokeWidth={2.5}
                  />
                </RadarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                No item data yet.
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">Quick read</p>
            <div className="mt-3 space-y-2">
              {topItemsBreakdown.length > 0 ? (
                topItemsBreakdown.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-neutral-900/40 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-white">{item.name}</p>
                      <p className="text-xs text-neutral-400">Rank #{index + 1}</p>
                    </div>
                    <p className="text-sm font-semibold text-amber-200">{item.quantity}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-400">No item data yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section className="rounded-[28px] border border-white/10 bg-neutral-900/60 p-3 shadow-xl backdrop-blur-2xl md:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white md:text-base">Recent Sales</h2>
              <p className="mt-1 text-[11px] text-neutral-400 md:text-xs">
                The latest transactions, ordered by time, with item summaries instead of just IDs.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-300">
              {recentSales.length} shown
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div key={`sales-skeleton-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-3 animate-pulse">
                    <div className="h-4 w-28 rounded-full bg-white/10" />
                    <div className="mt-3 h-3 w-3/4 rounded-full bg-white/10" />
                    <div className="mt-2 h-3 w-1/2 rounded-full bg-white/10" />
                  </div>
                ))
              : recentSales.length === 0 ? (
                  <p className="text-sm text-neutral-400">No sales yet.</p>
                ) : (
                  recentSales.map((sale) => (
                    <article key={sale.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{formatMoney(sale.total)}</p>
                          <p className="mt-1 text-xs text-neutral-400">{formatDateTime(sale.resolvedDate)}</p>
                        </div>
                        <div className="text-right text-xs text-neutral-300">
                          <p>{sale.staffName || sale.createdBy?.name || 'Unknown staff'}</p>
                          <p className="capitalize">{sale.payment?.method || 'unknown'}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-neutral-300">{sale.itemSummary}</p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-neutral-400">
                        <span>{sale.itemCount} items</span>
                        <span>{sale.storeName || scopeLabel}</span>
                      </div>
                    </article>
                  ))
                )}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-neutral-900/60 p-3 shadow-xl backdrop-blur-2xl md:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white md:text-base">Recent Refunds</h2>
              <p className="mt-1 text-[11px] text-neutral-400 md:text-xs">
                Refunds matter less than sales, so this stays compact and readable.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-300">
              {recentRefunds.length} shown
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div key={`refunds-skeleton-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-3 animate-pulse">
                    <div className="h-4 w-28 rounded-full bg-white/10" />
                    <div className="mt-3 h-3 w-3/4 rounded-full bg-white/10" />
                    <div className="mt-2 h-3 w-1/2 rounded-full bg-white/10" />
                  </div>
                ))
              : recentRefunds.length === 0 ? (
                  <p className="text-sm text-neutral-400">No refunds yet.</p>
                ) : (
                  recentRefunds.map((refund) => (
                    <article key={refund.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-rose-200">{formatMoney(refund.amount)}</p>
                          <p className="mt-1 text-xs text-neutral-400">{formatDateTime(refund.resolvedDate)}</p>
                        </div>
                        <div className="text-right text-xs text-neutral-300">
                          <p>{refund.staffName || 'Unknown staff'}</p>
                          <p className="capitalize">{refund.method || 'unknown'}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-neutral-300">
                        {refund.item || refund.productName || 'Unknown item'}
                      </p>
                      <p className="mt-1 text-xs text-neutral-400">{refund.reason || 'No reason provided'}</p>
                      <p className="mt-1 text-xs text-neutral-500">{refund.storeName || scopeLabel}</p>
                    </article>
                  ))
                )}
          </div>
        </section>
      </div>
    </div>
  );
}
