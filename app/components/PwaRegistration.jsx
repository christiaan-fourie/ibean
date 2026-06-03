'use client';

import { useEffect } from 'react';

export default function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return undefined;
    if (!('serviceWorker' in navigator)) return undefined;

    let active = true;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        if (!active) return;

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        });
      } catch (error) {
        console.error('Failed to register service worker:', error);
      }
    };

    register();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
