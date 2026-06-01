'use client';

import { useCollectionLive } from './useCollectionLive';

const extractTimestamp = (item) => {
  const candidateKeys = ['timestamp', 'createdAt', 'date', 'updatedAt', 'time'];

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

const sortByMostRecent = (items) => [...items].sort((a, b) => extractTimestamp(b) - extractTimestamp(a));

export function useDashboardOverviewData() {
  const sales = useCollectionLive('sales');
  const products = useCollectionLive('products');
  const specials = useCollectionLive('specials');
  const staff = useCollectionLive('staff');
  const vouchers = useCollectionLive('vouchers');
  const refunds = useCollectionLive('refunds');

  const isLoading = [sales, products, specials, staff, vouchers, refunds].some((item) => item.isLoading);
  const errors = [sales, products, specials, staff, vouchers, refunds].map((item) => item.error).filter(Boolean);

  const summaryCards = [
    { label: 'Sales Records', value: sales.data.length },
    { label: 'Products', value: products.data.length },
    { label: 'Active Specials', value: specials.data.length },
    { label: 'Staff', value: staff.data.length },
    { label: 'Vouchers', value: vouchers.data.length },
    { label: 'Refunds', value: refunds.data.length }
  ];

  const recentSales = sortByMostRecent(sales.data).slice(0, 5);
  const recentRefunds = sortByMostRecent(refunds.data).slice(0, 5);

  return {
    isLoading,
    errors,
    summaryCards,
    recentSales,
    recentRefunds
  };
}
