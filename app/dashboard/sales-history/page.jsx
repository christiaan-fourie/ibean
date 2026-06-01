'use client';

import { useEffect, useMemo, useState } from 'react';
import RouteGuard from '../../components/RouteGuard';
import { useDashboardSession } from '../../components/DashboardSessionContext';
import { useCollectionLive } from '../../hooks/useCollectionLive';
import { useToastNotification } from '../../hooks/useToastNotification';
import ToastNotification from '../../components/ToastNotification';
import { CHILLZONE_STORES, getStoreDisplayName } from '../../../utils/stores';

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfDay = (dateString) => {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (dateString) => {
  const date = new Date(dateString);
  date.setHours(23, 59, 59, 999);
  return date;
};

const resolveSaleDate = (sale) => {
  const candidate = sale?.date ?? sale?.timestamp ?? sale?.createdAt ?? null;
  if (!candidate) return null;
  if (typeof candidate?.toDate === 'function') return candidate.toDate();
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const money = (value) => {
  const numeric = Number(value) || 0;
  return `R ${numeric.toFixed(2)}`;
};

export default function SalesHistoryPage() {
  const { user, staffAuth, isSessionReady } = useDashboardSession();
  const { data: salesData, isLoading: salesLoading, error: salesError } = useCollectionLive('sales');
  const { notification, notify, clearNotification } = useToastNotification();

  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [dateRange, setDateRange] = useState({ start: today, end: today });
  const [selectedStore, setSelectedStore] = useState('all');
  const effectiveSelectedStore = staffAuth?.accountType === 'staff' && user?.email ? user.email : selectedStore;

  useEffect(() => {
    if (salesError) {
      notify('Failed to load sales in real-time.', 'error');
      console.error(salesError);
    }
  }, [salesError, notify]);

  const filteredSales = useMemo(() => {
    const from = startOfDay(dateRange.start);
    const to = endOfDay(dateRange.end);

    return [...salesData]
      .filter((sale) => {
        const saleDate = resolveSaleDate(sale);
        if (!saleDate) return false;

        const inRange = saleDate >= from && saleDate <= to;
        if (!inRange) return false;

        if (staffAuth?.accountType === 'staff' && user?.email) {
          return sale.storeId === user.email;
        }

        if (staffAuth?.accountType === 'manager' && effectiveSelectedStore !== 'all') {
          return sale.storeId === effectiveSelectedStore;
        }

        return true;
      })
      .sort((a, b) => {
        const da = resolveSaleDate(a)?.getTime() || 0;
        const db = resolveSaleDate(b)?.getTime() || 0;
        return db - da;
      });
  }, [salesData, dateRange, staffAuth, user, effectiveSelectedStore]);

  const handleDateChange = (key, value) => {
    setDateRange((prev) => ({ ...prev, [key]: value }));
  };

  const listIsLoading = !isSessionReady || salesLoading;

  return (
    <RouteGuard requiredRoles={['manager', 'staff']}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-neutral-900/40 p-3 text-neutral-50 md:p-4">
        {notification.message && (
          <ToastNotification
            key={notification.key}
            message={notification.message}
            type={notification.type}
            onClose={clearNotification}
            containerClassName="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-md border p-2.5 text-sm text-white shadow-lg animate-fade-in-up"
          />
        )}

        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Sales History</h1>
            <p className="text-sm text-neutral-400">All sales for the selected timeframe. Default is today.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300">
            {filteredSales.length} sales
          </div>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-neutral-900/70 p-3 shadow-lg backdrop-blur-xl sm:grid-cols-2 lg:max-w-3xl lg:grid-cols-3">
          <label className="text-xs text-neutral-300">
            Start Date
            <input
              type="date"
              value={dateRange.start}
              max={dateRange.end}
              onChange={(e) => handleDateChange('start', e.target.value)}
              className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
            />
          </label>
          <label className="text-xs text-neutral-300">
            End Date
            <input
              type="date"
              value={dateRange.end}
              min={dateRange.start}
              onChange={(e) => handleDateChange('end', e.target.value)}
              className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
            />
          </label>
          <label className="text-xs text-neutral-300">
            Store
            <select
              value={effectiveSelectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              disabled={staffAuth?.accountType === 'staff'}
              className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {staffAuth?.accountType === 'manager' && <option value="all">All stores</option>}
              {(staffAuth?.accountType === 'staff' && user?.email
                ? [{ id: user.email, name: getStoreDisplayName(user.email) }]
                : CHILLZONE_STORES
              ).map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="min-h-0 flex-1 overflow-y-auto rounded-3xl border border-white/10 bg-neutral-900/70 p-3 shadow-xl backdrop-blur-xl">
          {listIsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={`sales-history-skeleton-${index}`} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-neutral-400">No sales found for this timeframe.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredSales.map((sale) => {
                const saleDate = resolveSaleDate(sale);
                const items = Array.isArray(sale.items) ? sale.items : [];
                const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
                return (
                  <article key={sale.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{money(sale.total)}</p>
                        <p className="text-xs text-neutral-400">
                          {saleDate ? saleDate.toLocaleDateString('en-ZA') : 'Unknown date'} · {saleDate ? saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </p>
                      </div>
                      <div className="text-right text-xs text-neutral-300">
                        <p>{sale.staffName || sale.createdBy?.name || 'Unknown staff'}</p>
                        <p className="capitalize">{sale.payment?.method || 'unknown'}</p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                      <span>{itemCount} items</span>
                      <span className="rounded-full border border-white/10 bg-neutral-900/70 px-2 py-0.5">
                        {getStoreDisplayName(sale.storeId)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </RouteGuard>
  );
}
