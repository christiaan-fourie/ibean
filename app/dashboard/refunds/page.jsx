'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { FaPlus } from 'react-icons/fa';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getFirestore } from 'firebase/firestore';
import { auth } from '../../../utils/firebase';
import RouteGuard from '../../components/RouteGuard';

const getUtcMidnight = (date) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

export default function RefundsPage() {
  const [selectedDate, setSelectedDate] = useState(getUtcMidnight(new Date()));
  const [dailyRefunds, setDailyRefunds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newRefundReason, setNewRefundReason] = useState('');
  const [newRefundAmount, setNewRefundAmount] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const [user] = useAuthState(auth);
  const db = getFirestore();
  const dateInputRef = useRef(null);

  const formatDateDisplay = (date) => {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  };

  const formatPrice = (price) => {
    const numericPrice = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^\d.-]/g, '') || 0);
    return `R ${numericPrice.toFixed(2)}`;
  };

  const totalRefundsValue = useMemo(() => {
    return dailyRefunds.reduce((sum, refund) => sum + parseFloat(refund.amount), 0);
  }, [dailyRefunds]);

  const handleDateChange = (event) => {
    const dateValue = event.target.value;
    if (dateValue) {
      const [year, month, day] = dateValue.split('-').map(Number);
      setSelectedDate(new Date(Date.UTC(year, month - 1, day)));
    }
  };

  const getInputValue = (date) => {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleAddRefund = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');

    if (!user) {
      setAddError('You must be logged in to add refunds');
      return;
    }

    if (!newRefundReason.trim()) {
      setAddError('Please provide a reason for the refund');
      return;
    }

    const amountValue = parseFloat(newRefundAmount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setAddError('Please enter a valid refund amount');
      return;
    }

    setIsAdding(true);
    
    try {
      // Add your Firebase logic here to save the refund
      setAddSuccess('Refund added successfully');
      setNewRefundReason('');
      setNewRefundAmount('');
    } catch (err) {
      setAddError('Failed to add refund: ' + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <RouteGuard requiredRoles={['admin', 'manager']}>
    <div className="flex flex-col min-h-screen bg-neutral-900 text-neutral-50 p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Refunds: </h1>
        <input
          type="date"
          ref={dateInputRef}
          onChange={handleDateChange}
          value={getInputValue(selectedDate)}
          className="px-4 py-2 bg-neutral-800 rounded border border-neutral-700 text-white"
        />
      </div>

      {/* Add Refund Form */}
      <div className="mb-6 p-4 border border-neutral-700 rounded-lg bg-neutral-800">
        <h2 className="text-xl font-semibold mb-4">Add New Refund</h2>
        <form onSubmit={handleAddRefund} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              value={newRefundReason}
              onChange={(e) => setNewRefundReason(e.target.value)}
              placeholder="Refund reason"
              className="w-full p-2 bg-neutral-700 rounded border border-neutral-600"
            />
          </div>
          <div>
            <input
              type="number"
              value={newRefundAmount}
              onChange={(e) => setNewRefundAmount(e.target.value)}
              placeholder="Amount (R)"
              step="0.01"
              min="0.01"
              className="w-full p-2 bg-neutral-700 rounded border border-neutral-600"
            />
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={isAdding}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white"
            >
              <FaPlus /> {isAdding ? 'Adding...' : 'Add Refund'}
            </button>
          </div>
        </form>
        {addError && <p className="mt-3 text-red-400">{addError}</p>}
        {addSuccess && <p className="mt-3 text-green-400">{addSuccess}</p>}
      </div>

      {/* Refunds List */}
      <div className="flex-grow">
        {isLoading ? (
          <div className="text-center py-8">Loading refunds...</div>
        ) : error ? (
          <div className="text-center text-red-500 py-8">{error}</div>
        ) : dailyRefunds.length === 0 ? (
          <div className="text-center text-neutral-500 py-8">
            No refunds recorded for {formatDateDisplay(selectedDate)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-800">
                <tr>
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-left">Reason</th>
                  <th className="px-4 py-2 text-left">Processed By</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {dailyRefunds.map((refund) => (
                  <tr key={refund.id} className="hover:bg-neutral-750">
                    <td className="px-4 py-2">{formatTime(refund.timestamp)}</td>
                    <td className="px-4 py-2">{refund.reason}</td>
                    <td className="px-4 py-2">{refund.username}</td>
                    <td className="px-4 py-2 text-right text-red-400">
                      {formatPrice(refund.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 text-right">
              <p className="text-xl font-bold">
                Total Refunds: {formatPrice(totalRefundsValue)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
    </RouteGuard>
  );
}