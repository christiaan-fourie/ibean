'use client';

import { useEffect, useState } from 'react';
import db from '../../utils/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useDashboardSession } from '../components/DashboardSessionContext';

export default function DashboardHome() {
  const [storeData, setStoreData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { staffAuth } = useDashboardSession();

  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        const salesData = [];
        const productsData = [];
        const specialsData = [];
        const staffData = [];
        const refundData = [];
        const voucherData = [];

        const salesSnapshot = await getDocs(collection(db, 'sales'));
        salesSnapshot.forEach((doc) => salesData.push({ id: doc.id, ...doc.data() }));

        const productsSnapshot = await getDocs(collection(db, 'products'));
        productsSnapshot.forEach((doc) => productsData.push({ id: doc.id, ...doc.data() }));

        const specialsSnapshot = await getDocs(collection(db, 'specials'));
        specialsSnapshot.forEach((doc) => specialsData.push({ id: doc.id, ...doc.data() }));

        const staffSnapshot = await getDocs(collection(db, 'staff'));
        staffSnapshot.forEach((doc) => staffData.push({ id: doc.id, ...doc.data() }));

        const refundsSnapshot = await getDocs(collection(db, 'refunds'));
        refundsSnapshot.forEach((doc) => refundData.push({ id: doc.id, ...doc.data() }));

        const vouchersSnapshot = await getDocs(collection(db, 'vouchers'));
        vouchersSnapshot.forEach((doc) => voucherData.push({ id: doc.id, ...doc.data() }));

        setStoreData({
          sales: salesData,
          products: productsData,
          specials: specialsData,
          staff: staffData,
          vouchers: voucherData,
          refunds: refundData
        });
      } catch (error) {
        console.error('Error fetching store data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStoreData();
  }, []);

  const summaryCards = [
    { label: 'Sales Records', value: storeData?.sales?.length ?? 0 },
    { label: 'Products', value: storeData?.products?.length ?? 0 },
    { label: 'Active Specials', value: storeData?.specials?.length ?? 0 },
    { label: 'Staff', value: storeData?.staff?.length ?? 0 },
    { label: 'Vouchers', value: storeData?.vouchers?.length ?? 0 },
    { label: 'Refunds', value: storeData?.refunds?.length ?? 0 }
  ];

  const extractTimestamp = (item) => {
    const candidateKeys = ['timestamp', 'createdAt', 'date', 'updatedAt', 'time'];

    for (const key of candidateKeys) {
      const value = item?.[key];
      if (!value) continue;

      if (typeof value?.toDate === 'function') {
        return value.toDate().getTime();
      }

      if (typeof value?.seconds === 'number') {
        return value.seconds * 1000;
      }

      if (typeof value === 'number') {
        return value;
      }

      if (typeof value === 'string') {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) return parsed;
      }
    }

    return 0;
  };

  const sortByMostRecent = (items) =>
    [...items].sort((a, b) => extractTimestamp(b) - extractTimestamp(a));

  const recentSales = sortByMostRecent(storeData?.sales ?? []).slice(0, 5);
  const recentRefunds = sortByMostRecent(storeData?.refunds ?? []).slice(0, 5);

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
