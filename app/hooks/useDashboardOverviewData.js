'use client';

import { useMemo } from 'react';
import { useCollectionLive } from './useCollectionLive';
import { getStoreDisplayName } from '../../utils/stores';
import { getSaleNetTotal } from '../../utils/pricing/saleAmounts';

const pad = (value) => String(value).padStart(2, '0');

const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatMoney = (value) => `R ${Number(value || 0).toFixed(2)}`;

const formatHourLabel = (hour) => `${pad(hour)}:00`;

const extractTimestamp = (item) => {
  const candidateKeys = ['timestamp', 'createdAt', 'date', 'updatedAt', 'time', 'redeemedAt', 'usedAt'];

  for (const key of candidateKeys) {
    const value = item?.[key];
    if (!value) continue;

    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    if (typeof value === 'number') return value;

    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }

  return 0;
};

const resolveDate = (item) => {
  const timestamp = extractTimestamp(item);
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
};

const sortByMostRecent = (items) => [...items].sort((a, b) => extractTimestamp(b) - extractTimestamp(a));

const paymentBucket = (method) => {
  const normalized = (method || 'unknown').toLowerCase();
  if (normalized === 'cash') return 'Cash';
  if (normalized === 'card') return 'Card';
  if (normalized === 'snapscan') return 'Snapscan';
  if (normalized === 'voucher') return 'Voucher';
  return 'Other';
};

const formatItemSummary = (items, limit = 2) => {
  if (!Array.isArray(items) || items.length === 0) return 'No line items recorded';

  return items
    .slice(0, limit)
    .map((item) => {
      const quantity = Number(item?.quantity) || 1;
      const name = item?.name || item?.productName || 'Item';
      const variant = item?.size || item?.variety || item?.selectedVariety || '';
      return `${quantity}x ${variant ? `${name} (${variant})` : name}`;
    })
    .join(' · ');
};

const getStoreScope = (user, staffAuth) => {
  if (staffAuth?.accountType === 'staff') {
    return staffAuth?.storeId || user?.email || null;
  }

  return null;
};

export function useDashboardOverviewData({ user, staffAuth, range = 'today' } = {}) {
  const sales = useCollectionLive('sales');
  const products = useCollectionLive('products');
  const specials = useCollectionLive('specials');
  const staff = useCollectionLive('staff');
  const vouchers = useCollectionLive('vouchers');
  const refunds = useCollectionLive('refunds');
  const referenceNow = useMemo(() => new Date(), []);

  const isLoading = [sales, products, specials, staff, vouchers, refunds].some((item) => item.isLoading);
  const errors = [sales, products, specials, staff, vouchers, refunds].map((item) => item.error).filter(Boolean);

  return useMemo(() => {
    const scopeStart = (() => {
      const start = new Date(referenceNow);
      start.setHours(0, 0, 0, 0);

      if (range === '7d') {
        start.setDate(start.getDate() - 6);
      } else if (range === 'mtd') {
        start.setDate(1);
      }

      return start;
    })();
    const scopeEnd = new Date(referenceNow);
    scopeEnd.setHours(23, 59, 59, 999);

    const inSelectedRange = (date) => date && date >= scopeStart && date <= scopeEnd;
    const storeScopeId = getStoreScope(user, staffAuth);
    const scopeLabel = storeScopeId ? getStoreDisplayName(storeScopeId) : 'All stores';
    const currentScope = storeScopeId
      ? sales.data.filter((sale) => sale?.storeId === storeScopeId)
      : sales.data;
    const currentRefunds = storeScopeId
      ? refunds.data.filter((refund) => refund?.storeId === storeScopeId)
      : refunds.data;
    const selectedSales = currentScope.filter((sale) => inSelectedRange(resolveDate(sale)));
    const selectedRefunds = currentRefunds.filter((refund) => inSelectedRange(resolveDate(refund)));

    const revenueToday = selectedSales.reduce((sum, sale) => sum + getSaleNetTotal(sale), 0);
    const refundsTodayValue = selectedRefunds.reduce((sum, refund) => sum + (Number(refund.amount) || 0), 0);
    const itemsSoldToday = selectedSales.reduce(
      (sum, sale) => sum + (Array.isArray(sale.items) ? sale.items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 1), 0) : 0),
      0
    );
    const averageSaleToday = selectedSales.length > 0 ? revenueToday / selectedSales.length : 0;

    const paymentMix = {};
    const hourBuckets = {};
    const itemCounts = {};
    const itemCounts30Days = {};

    selectedSales.forEach((sale) => {
      const bucket = paymentBucket(sale?.payment?.method);
      paymentMix[bucket] = (paymentMix[bucket] || 0) + 1;

      const saleDate = resolveDate(sale);
      if (saleDate) {
        const hour = saleDate.getHours();
        hourBuckets[hour] = (hourBuckets[hour] || 0) + 1;
      }

      for (const item of sale.items || []) {
        const itemName = item?.name || item?.productName || 'Item';
        itemCounts[itemName] = (itemCounts[itemName] || 0) + (Number(item?.quantity) || 1);
      }
    });

    currentScope.forEach((sale) => {
      const saleDate = resolveDate(sale);
      if (!saleDate || saleDate.getTime() < referenceNow.getTime() - 30 * 24 * 60 * 60 * 1000) return;

      for (const item of sale.items || []) {
        const itemName = item?.name || item?.productName || 'Item';
        itemCounts30Days[itemName] = (itemCounts30Days[itemName] || 0) + (Number(item?.quantity) || 1);
      }
    });

    const topPaymentEntry = Object.entries(paymentMix).sort((a, b) => b[1] - a[1])[0];
    const topItemEntry = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];
    const busiestHourEntry = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
    const topItemsBreakdown = Object.entries(itemCounts30Days)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 6);
    const paymentMixBreakdown = Object.entries(paymentMix)
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count);

    const selectedTrend = [];
    if (range === 'today') {
      for (let hour = 8; hour <= 20; hour += 1) {
        const hourStart = new Date(scopeStart);
        hourStart.setHours(hour, 0, 0, 0);
        const hourEnd = new Date(hourStart);
        hourEnd.setMinutes(59, 59, 999);
        const hourSales = selectedSales.filter((sale) => {
          const saleDate = resolveDate(sale);
          return saleDate ? saleDate >= hourStart && saleDate <= hourEnd : false;
        });
        const total = hourSales.reduce((sum, sale) => sum + getSaleNetTotal(sale), 0);
        selectedTrend.push({
          key: `${toDateKey(hourStart)}-${pad(hour)}`,
          label: formatHourLabel(hour),
          date: hourStart,
          value: total,
        });
      }
    } else {
      const trendCursor = new Date(scopeStart);
      while (trendCursor <= scopeEnd) {
        const dayStart = new Date(trendCursor);
        const dayEnd = new Date(trendCursor);
        dayEnd.setHours(23, 59, 59, 999);
        const key = toDateKey(dayStart);
        const daySales = selectedSales.filter((sale) => {
          const saleDate = resolveDate(sale);
          return saleDate ? saleDate >= dayStart && saleDate <= dayEnd : false;
        });
        const total = daySales.reduce((sum, sale) => sum + getSaleNetTotal(sale), 0);
        selectedTrend.push({
          key,
          label: dayStart.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }),
          date: dayStart,
          value: total,
        });
        trendCursor.setDate(trendCursor.getDate() + 1);
      }
    }

    const summaryCards = [
      {
        label: 'Transactions',
        value: selectedSales.length,
        hint: `${selectedSales.length} in selected range`,
      },
      {
        label: 'Net sales',
        value: formatMoney(revenueToday),
        hint: `Avg sale ${formatMoney(averageSaleToday)}`,
      },
      {
        label: 'Refunds',
        value: formatMoney(refundsTodayValue),
        hint: `${selectedRefunds.length} refunds`,
      },
      {
        label: 'Items sold',
        value: itemsSoldToday,
        hint: topItemEntry ? `Top item: ${topItemEntry[0]}` : 'No item data yet',
      },
      {
        label: 'Top payment',
        value: topPaymentEntry ? topPaymentEntry[0] : 'N/A',
        hint: topPaymentEntry ? `${topPaymentEntry[1]} transactions` : 'No transactions yet',
      },
      {
        label: 'Busiest hour',
        value: busiestHourEntry ? `${pad(Number(busiestHourEntry[0]))}:00` : 'N/A',
        hint: busiestHourEntry ? `${busiestHourEntry[1]} transactions` : 'No hourly pattern yet',
      },
    ];

    const recentSales = sortByMostRecent(selectedSales).slice(0, 5).map((sale) => {
      const saleDate = resolveDate(sale);
      return {
        ...sale,
        resolvedDate: saleDate,
        storeName: getStoreDisplayName(sale?.storeId),
        itemCount: Array.isArray(sale.items)
          ? sale.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
          : 0,
        itemSummary: formatItemSummary(sale.items),
      };
    });

    const recentRefunds = sortByMostRecent(selectedRefunds).slice(0, 5).map((refund) => {
      const refundDate = resolveDate(refund);
      return {
        ...refund,
        resolvedDate: refundDate,
        storeName: getStoreDisplayName(refund?.storeId),
        amount: Number(refund.amount) || 0,
      };
    });

    return {
      scopeLabel,
      summaryCards,
      selectedTrend,
      topPaymentLabel: topPaymentEntry ? topPaymentEntry[0] : 'N/A',
      topPaymentCount: topPaymentEntry ? topPaymentEntry[1] : 0,
      topItemName: topItemEntry ? topItemEntry[0] : 'N/A',
      topItemCount: topItemEntry ? topItemEntry[1] : 0,
      topItemsBreakdown,
      busiestHourLabel: busiestHourEntry ? `${pad(Number(busiestHourEntry[0]))}:00` : 'N/A',
      busiestHourCount: busiestHourEntry ? busiestHourEntry[1] : 0,
      paymentMixBreakdown,
      recentSales,
      recentRefunds,
      isLoading,
      errors,
    };
  }, [errors, isLoading, range, referenceNow, refunds.data, sales.data, staffAuth, user]);
}
