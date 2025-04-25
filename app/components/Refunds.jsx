// /home/krist/dev/ibean/app/components/Refunds.jsx
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getFirestore, collection, query, where, orderBy, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { auth } from '../../utils/firebase'; // Adjust path if needed
import { useAuthState } from 'react-firebase-hooks/auth';
import { FaPlus } from 'react-icons/fa'; // Icon for add button

// Helper function to get the start of a day in UTC (same as in Sales.jsx)
const getUtcMidnight = (date) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const Refunds = ({ onClose }) => {
  // Initialize selectedDate to the start of the current day in UTC
  const [selectedDate, setSelectedDate] = useState(getUtcMidnight(new Date()));
  const [dailyRefunds, setDailyRefunds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false); // State for add form visibility/loading
  const [error, setError] = useState(null);
  const [addError, setAddError] = useState(''); // Error specific to adding
  const [addSuccess, setAddSuccess] = useState(''); // Success message for adding

  // Form state for new refund
  const [newRefundReason, setNewRefundReason] = useState('');
  const [newRefundAmount, setNewRefundAmount] = useState('');

  const db = getFirestore();
  const [user] = useAuthState(auth);
  const dateInputRef = useRef(null);
  const reasonInputRef = useRef(null); // Ref for focusing reason input

  // Function to format date display based on UTC components (same as Sales.jsx)
  const formatDateDisplay = (date) => {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC' // Specify UTC for formatting
    });
  };

  // Fetch refunds for the selected date
  const fetchDailyRefunds = async (dateToFetch) => {
    setIsLoading(true);
    setError(null);
    setDailyRefunds([]); // Clear previous refunds

    try {
      const refundsCollectionRef = collection(db, 'refunds'); // Use 'refunds' collection

      // dateToFetch is already UTC midnight
      const startOfDay = new Date(dateToFetch); // Copy the UTC date

      // Calculate end of the day based on the UTC date
      const endOfDay = new Date(dateToFetch);
      endOfDay.setUTCHours(23, 59, 59, 999); // Use setUTCHours

      const startTimestamp = Timestamp.fromDate(startOfDay); // From UTC date
      const endTimestamp = Timestamp.fromDate(endOfDay);   // From UTC date

      const q = query(
        refundsCollectionRef,
        where('timestamp', '>=', startTimestamp),
        where('timestamp', '<=', endTimestamp),
        orderBy('timestamp', 'desc') // Show newest first
      );

      const querySnapshot = await getDocs(q);
      const refundsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Ensure amount is a number when fetching
        amount: typeof doc.data().amount === 'number' ? doc.data().amount : parseFloat(String(doc.data().amount).replace(/[^\d.-]/g, '') || 0),
        timestamp: doc.data().timestamp.toDate(), // Keep as JS Date for local formatting (like time)
      }));

      setDailyRefunds(refundsData);
    } catch (err) {
      console.error("Error fetching daily refunds:", err);
      setError(`Failed to load refund data for ${formatDateDisplay(dateToFetch)}. Please try again later.`);
    } finally {
      setIsLoading(false);
    }
  };

  // useEffect to fetch refunds when selectedDate changes
  useEffect(() => {
    fetchDailyRefunds(selectedDate);
  }, [db, selectedDate]); // Removed fetchDailyRefunds from dependency array

  // Calculate total refunds for the day using useMemo
  const totalRefundsValue = useMemo(() => {
    return dailyRefunds.reduce((sum, refund) => {
      const amount = typeof refund.amount === 'number' ? refund.amount : 0;
      return sum + amount;
    }, 0);
  }, [dailyRefunds]);

  // Format time (same as Sales.jsx)
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Format price/amount (same as Sales.jsx)
  const formatPrice = (price) => {
    const numericPrice = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^\d.-]/g, '') || 0);
    return `R ${numericPrice.toFixed(2)}`;
  };

  // Handle date change (same as Sales.jsx)
  const handleDateChange = (event) => {
    const dateValue = event.target.value; // "YYYY-MM-DD"
    if (dateValue) {
        const [year, month, day] = dateValue.split('-').map(Number);
        const utcDate = new Date(Date.UTC(year, month - 1, day));
        setSelectedDate(utcDate);
    }
  };

  // Open date picker (same as Sales.jsx)
  const openDatePicker = () => {
      dateInputRef.current?.showPicker();
  };

  // Get YYYY-MM-DD string for input value (same as Sales.jsx)
  const getInputValue = (date) => {
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  // Handle adding a new refund
  const handleAddRefund = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');

    if (!user) {
        setAddError("You must be logged in to add a refund.");
        return;
    }
    if (!newRefundReason.trim()) {
        setAddError("Refund reason cannot be empty.");
        reasonInputRef.current?.focus(); // Focus the reason input
        return;
    }
    const amountValue = parseFloat(newRefundAmount);
    if (isNaN(amountValue) || amountValue <= 0) {
        setAddError("Please enter a valid positive refund amount.");
        return;
    }

    setIsAdding(true); // Indicate processing

    try {
        const refundsCollectionRef = collection(db, 'refunds');
        const refundData = {
            reason: newRefundReason.trim(),
            amount: amountValue,
            timestamp: Timestamp.now(), // Use server timestamp
            username: user.email || 'Unknown User' // Store who processed it
        };

        await addDoc(refundsCollectionRef, refundData);

        setAddSuccess(`Refund of ${formatPrice(amountValue)} added successfully!`);
        setNewRefundReason(''); // Clear form
        setNewRefundAmount('');

        // Refetch refunds for the *current* selected date to show the new entry
        await fetchDailyRefunds(selectedDate);

        // Optionally clear success message after a delay
        setTimeout(() => setAddSuccess(''), 3000);

    } catch (err) {
        console.error("Error adding refund:", err);
        setAddError("Failed to add refund. Please try again.");
        // Optionally clear error message after a delay
        setTimeout(() => setAddError(''), 5000);
    } finally {
        setIsAdding(false); // Finish processing
    }
  };


  return (
    <div id="refunds-modal-overlay" className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div id="refunds-modal-content" className="border bg-neutral-800 p-6 rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col text-white">
        {/* Header */}
        <div id="refunds-modal-header" className="flex justify-between items-center mb-4 flex-shrink-0 gap-4">
          <h2 className="text-xl md:text-2xl font-semibold text-white whitespace-nowrap">
            Refunds:
          </h2>
          {/* Date Picker Button */}
          <button
            onClick={openDatePicker}
            className="flex-grow text-center px-4 py-1 bg-neutral-700 hover:bg-neutral-600 rounded border border-neutral-600 text-lg font-medium text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-800"
            title="Select Date"
          >
            {formatDateDisplay(selectedDate)}
          </button>
          <input
             type="date"
             ref={dateInputRef}
             onChange={handleDateChange}
             value={getInputValue(selectedDate)}
             className="opacity-0 w-0 h-0 absolute"
             aria-hidden="true"
           />
          {/* Close Button */}
          <button
            onClick={onClose}
            className="text-red-500 hover:text-red-700 font-bold text-2xl leading-none flex-shrink-0"
            title="Close Refunds"
          >
            &times;
          </button>
        </div>

        {/* Add Refund Form */}
        <div className="mb-4 p-4 border border-neutral-700 rounded-md bg-neutral-750 flex-shrink-0">
            <h3 className="text-lg font-semibold mb-3 text-neutral-200">Add New Refund</h3>
            <form onSubmit={handleAddRefund} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                {/* Reason Input */}
                <div className="md:col-span-2">
                    <label htmlFor="refundReason" className="block text-sm font-medium text-gray-300 mb-1">Reason</label>
                    <input
                        type="text"
                        id="refundReason"
                        ref={reasonInputRef} // Assign ref
                        value={newRefundReason}
                        onChange={(e) => setNewRefundReason(e.target.value)}
                        className="p-2 block w-full rounded-md border-gray-600 bg-neutral-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="e.g., Wrong item, Customer complaint"
                        disabled={isAdding}
                    />
                </div>
                {/* Amount Input */}
                <div>
                    <label htmlFor="refundAmount" className="block text-sm font-medium text-gray-300 mb-1">Amount (R)</label>
                    <input
                        type="number"
                        id="refundAmount"
                        value={newRefundAmount}
                        onChange={(e) => setNewRefundAmount(e.target.value)}
                        step="0.01"
                        min="0.01"
                        className="p-2 block w-full rounded-md border-gray-600 bg-neutral-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="0.00"
                        disabled={isAdding}
                    />
                </div>
                {/* Submit Button */}
                <div className="md:col-span-3 flex justify-end">
                    <button
                        type="submit"
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-750 disabled:opacity-50"
                        disabled={isAdding}
                    >
                        <FaPlus /> {isAdding ? 'Adding...' : 'Add Refund'}
                    </button>
                </div>
            </form>
            {/* Add Refund Messages */}
            {addError && <p className="mt-3 text-sm text-red-400 text-center">{addError}</p>}
            {addSuccess && <p className="mt-3 text-sm text-green-400 text-center">{addSuccess}</p>}
        </div>

        {/* Refunds List Area */}
        <div className="flex-grow overflow-y-auto pr-1">
            {isLoading && <div className="text-center text-neutral-400 py-8">Loading refunds for {formatDateDisplay(selectedDate)}...</div>}
            {error && <div className="text-center text-red-500 py-8">{error}</div>}

            {!isLoading && !error && dailyRefunds.length === 0 && (
              <div className="text-center text-neutral-500 py-8">No refunds recorded on {formatDateDisplay(selectedDate)}.</div>
            )}

            {!isLoading && !error && dailyRefunds.length > 0 && (
              <>
                <table className="min-w-full bg-neutral-800">
                  <thead className="bg-neutral-700 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">Time</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">Reason</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">Processed By</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-neutral-300 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-700">
                    {dailyRefunds.map((refund) => (
                      <tr key={refund.id} className="hover:bg-neutral-750">
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-200">{formatTime(refund.timestamp)}</td>
                        <td className="px-4 py-2 text-sm text-neutral-200">{refund.reason}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-300">{refund.username}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-400 text-right font-medium">{formatPrice(refund.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Daily Total */}
                <div className="mt-4 pt-4 border-t border-neutral-700 text-right pr-4">
                  <span className="text-lg font-semibold text-neutral-300">Total Refunds for {formatDateDisplay(selectedDate)}: </span>
                  <span className="text-xl font-bold text-red-400">{formatPrice(totalRefundsValue)}</span>
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  );
};

export default Refunds;