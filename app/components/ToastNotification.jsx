'use client';

import { useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

export default function ToastNotification({
  message,
  type,
  onClose,
  duration = 4000,
  containerClassName = 'fixed bottom-5 right-5 p-4 rounded-lg shadow-lg flex items-center gap-3 text-white border animate-fade-in-up z-50',
  showCloseButton = false,
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const isSuccess = type === 'success';
  const bgColor = isSuccess ? 'bg-green-600/30 border-green-500' : 'bg-red-600/30 border-red-500';
  const icon = isSuccess ? <FaCheckCircle className="text-green-400" /> : <FaExclamationCircle className="text-red-400" />;

  return (
    <div className={`${containerClassName} ${bgColor}`}>
      {icon}
      <span>{message}</span>
      {showCloseButton && (
        <button onClick={onClose} className="ml-4 text-xl font-light">
          &times;
        </button>
      )}
    </div>
  );
}
