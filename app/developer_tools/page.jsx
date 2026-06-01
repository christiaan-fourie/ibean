'use client';

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '../../utils/firebase';
import { useCollectionLive } from '../hooks/useCollectionLive';
import { useToastNotification } from '../hooks/useToastNotification';
import ToastNotification from '../components/ToastNotification';
import ProductDataAuditor from '../components/ProductDataAuditor';
import CategoryDataAuditor from '../components/CategoryDataAuditor';

const STAFF_AUTH_TTL_MS = 5 * 60 * 1000;

export default function DeveloperToolsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { data: productsData, error: productsError } = useCollectionLive('products');
  const { data: categoriesData, error: categoriesError } = useCollectionLive('categories');
  const { notification, notify, clearNotification } = useToastNotification();

  const products = useMemo(
    () => [...productsData].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [productsData]
  );

  const categories = useMemo(
    () =>
      [...categoriesData]
        .filter((cat) => cat.active)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [categoriesData]
  );

  useEffect(() => {
    if (productsError) {
      notify('Failed to fetch products in real-time.', 'error');
      console.error(productsError);
    }
    if (categoriesError) {
      notify('Failed to fetch categories in real-time.', 'error');
      console.error(categoriesError);
    }
  }, [productsError, categoriesError, notify]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setIsAuthorized(false);
        setLoading(false);
        router.replace('/dashboard');
        return;
      }

      let parsedAuth = null;
      try {
        const stored = localStorage.getItem('staffAuth');
        parsedAuth = stored ? JSON.parse(stored) : null;
      } catch {
        parsedAuth = null;
      }

      const validStaffSession =
        parsedAuth &&
        parsedAuth.accountType === 'manager' &&
        Date.now() - Number(parsedAuth.timestamp || 0) < STAFF_AUTH_TTL_MS;

      if (!validStaffSession) {
        setIsAuthorized(false);
        setLoading(false);
        router.replace('/dashboard');
        return;
      }

      setIsAuthorized(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-900 text-neutral-100">
        Loading developer tools...
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-900/50 p-4 text-neutral-50 md:p-6">
      {notification.message && (
        <ToastNotification
          key={notification.key}
          message={notification.message}
          type={notification.type}
          onClose={clearNotification}
          containerClassName="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-md border p-2.5 text-sm text-white shadow-lg animate-fade-in-up"
        />
      )}

      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-white">Developer Tools</h1>
          <p className="text-sm text-neutral-400">Internal diagnostics. No public navigation link.</p>
        </div>

        <ProductDataAuditor
          products={products}
          categories={categories}
          showNotification={notify}
        />
        <div className="mt-4">
          <CategoryDataAuditor
            categories={categories}
            showNotification={notify}
          />
        </div>
      </div>
    </div>
  );
}
