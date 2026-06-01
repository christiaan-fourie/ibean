'use client';

import { useState } from 'react';

const EMPTY_NOTIFICATION = { key: 0, message: '', type: '' };

export function useToastNotification() {
  const [notification, setNotification] = useState(EMPTY_NOTIFICATION);

  const notify = (message, type) => {
    setNotification({ key: Date.now(), message, type });
  };

  const clearNotification = () => {
    setNotification(EMPTY_NOTIFICATION);
  };

  return {
    notification,
    notify,
    clearNotification,
    setNotification,
  };
}
