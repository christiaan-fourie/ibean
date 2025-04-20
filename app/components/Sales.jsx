'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getFirestore, collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { auth } from '../../utils/firebase'; // Adjust path if needed
import { useAuthState } from 'react-firebase-hooks/auth';
import jsPDF from 'jspdf'; // Import jsPDF
import autoTable from 'jspdf-autotable'; // Import jspdf-autotable

// Helper function to get the start of a day in UTC
const getUtcMidnight = (date) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const Sales = ({ onClose }) => {
  // Initialize selectedDate to the start of the current day in UTC
  const [selectedDate, setSelectedDate] = useState(getUtcMidnight(new Date()));
  const [dailySales, setDailySales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const db = getFirestore();
  const [user] = useAuthState(auth);
  const dateInputRef = useRef(null);

  // Function to format date display based on UTC components
  const formatDateDisplay = (date) => {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC' // Specify UTC for formatting
    });
  };

  useEffect(() => {
    const fetchDailySales = async () => {
      setIsLoading(true);
      setError(null);
      setDailySales([]);

      try {
        const salesCollectionRef = collection(db, 'sales');

        // selectedDate is already UTC midnight
        const startOfDay = new Date(selectedDate); // Copy the UTC date

        // Calculate end of the day based on the UTC date
        const endOfDay = new Date(selectedDate);
        endOfDay.setUTCHours(23, 59, 59, 999); // Use setUTCHours

        const startTimestamp = Timestamp.fromDate(startOfDay); // From UTC date
        const endTimestamp = Timestamp.fromDate(endOfDay);   // From UTC date

        const q = query(
          salesCollectionRef,
          where('timestamp', '>=', startTimestamp),
          where('timestamp', '<=', endTimestamp),
          orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const salesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Ensure totalPrice is a number when fetching
          totalPrice: typeof doc.data().totalPrice === 'number' ? doc.data().totalPrice : parseFloat(String(doc.data().totalPrice).replace(/[^\d.-]/g, '') || 0),
          // Ensure items is always an array
          items: Array.isArray(doc.data().items) ? doc.data().items : [],
          timestamp: doc.data().timestamp.toDate(), // Keep as JS Date for local formatting (like time)
        }));

        setDailySales(salesData);
      } catch (err) {
        console.error("Error fetching daily sales:", err);
        setError(`Failed to load sales data for ${formatDateDisplay(selectedDate)}. Please try again later.`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailySales();
  }, [db, selectedDate]);

  // Calculate summary statistics using useMemo
  const salesStats = useMemo(() => {
    const totalSalesValue = dailySales.reduce((sum, sale) => {
      const price = typeof sale.totalPrice === 'number' ? sale.totalPrice : 0;
      return sum + price;
    }, 0);

    const totalNumberOfSales = dailySales.length;

    const itemSummary = {};
    let totalItemsSoldCount = 0;

    dailySales.forEach(sale => {
        // Check if sale.items is an array before iterating
        if (Array.isArray(sale.items)) {
            sale.items.forEach(item => {
                const itemName = item.name || 'Unknown Item'; // Handle potential missing names
                const quantity = typeof item.quantity === 'number' ? item.quantity : 0; // Ensure quantity is a number
                itemSummary[itemName] = (itemSummary[itemName] || 0) + quantity;
                totalItemsSoldCount += quantity;
            });
        }
    });

    const averageSaleValue = totalNumberOfSales > 0 ? totalSalesValue / totalNumberOfSales : 0;

    return {
      totalSalesValue,
      totalNumberOfSales,
      totalItemsSoldCount,
      averageSaleValue,
      itemSummary,
    };
  }, [dailySales]);

  const formatTime = (date) => {
    // Time formatting can remain local as it displays the time part of the timestamp
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatPrice = (price) => {
    const numericPrice = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^\d.-]/g, '') || 0);
    return `R ${numericPrice.toFixed(2)}`;
  };

  // Handle date change ensuring the new date is UTC midnight
  const handleDateChange = (event) => {
    const dateValue = event.target.value; // "YYYY-MM-DD"
    if (dateValue) {
        const [year, month, day] = dateValue.split('-').map(Number);
        // Create Date object representing midnight UTC for the selected date
        const utcDate = new Date(Date.UTC(year, month - 1, day));
        setSelectedDate(utcDate);
    }
  };

  const openDatePicker = () => {
      dateInputRef.current?.showPicker();
  };

  // Get YYYY-MM-DD string based on UTC components for the input value
  const getInputValue = (date) => {
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // M+1 and pad
      const day = date.getUTCDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  // Function to generate and download PDF with stats
  const handleExportPdf = () => {
    if (dailySales.length === 0) return; // Don't generate if no sales

    const doc = new jsPDF();
    const tableColumns = ["Time", "Username", "Items", "Total Price"];
    const tableRows = [];
    const {
        totalSalesValue,
        totalNumberOfSales,
        totalItemsSoldCount,
        averageSaleValue,
        itemSummary
    } = salesStats; // Destructure calculated stats

    // Title for the PDF
    doc.setFontSize(18);
    doc.text(`Sales Report: ${formatDateDisplay(selectedDate)}`, 14, 22);
    doc.setFontSize(11); // Reset font size for table

    // Prepare table data
    dailySales.forEach(sale => {
      const itemsString = sale.items.map(item =>
        `${item.quantity || 0} x ${item.name || '?'} (${formatPrice(item.price || 0)})`
      ).join("\n"); // Join items with newline for multi-line cell

      const saleData = [
        formatTime(sale.timestamp),
        sale.username,
        itemsString,
        formatPrice(sale.totalPrice) // Format total price for the row
      ];
      tableRows.push(saleData);
    });

    // Add table using autoTable
    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: 30, // Start table below the title
      theme: 'grid', // Options: 'striped', 'grid', 'plain'
      styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' }, // Added overflow
      headStyles: { fillColor: [75, 85, 99], fontSize: 9 }, // Neutral-700 equivalent
      columnStyles: {
          0: { cellWidth: 18 }, // Time
          1: { cellWidth: 30 }, // Username
          2: { cellWidth: 'auto'}, // Items (let it take remaining space)
          3: { halign: 'right', cellWidth: 25 }, // Total Price
      }
    });

    // Add total sales below the table
    let finalY = doc.lastAutoTable.finalY; // Get Y position of the end of the table
    doc.setFontSize(12);
    doc.text(`Total for ${formatDateDisplay(selectedDate)}: ${formatPrice(totalSalesValue)}`, 14, finalY + 10);

    // --- Add Statistics Section ---
    doc.setFontSize(12);
    doc.text("Daily Summary:", 14, finalY + 15);
    doc.setFontSize(10);

    const statsStartY = finalY + 20;
    let currentY = statsStartY;

    // Basic Stats
    doc.text(`Total Sales Value: ${formatPrice(totalSalesValue)}`, 14, currentY);
    doc.text(`Total Transactions: ${totalNumberOfSales}`, 100, currentY); // Position second stat inline
    currentY += 6; // Increment Y position
    doc.text(`Total Items Sold: ${totalItemsSoldCount}`, 14, currentY);
    doc.text(`Average Sale Value: ${formatPrice(averageSaleValue)}`, 100, currentY);
    currentY += 10; // Add more space before item summary

    // Item Summary Table
    doc.setFontSize(11);
    doc.text("Item Summary:", 14, currentY);
    currentY += 6;
    const itemTableColumns = ["Item Name", "Quantity Sold"];
    const itemTableRows = Object.entries(itemSummary) // Convert object to array [key, value]
                             .sort(([, qtyA], [, qtyB]) => qtyB - qtyA) // Sort by quantity descending
                             .map(([name, quantity]) => [name, quantity]);

    autoTable(doc, {
        head: [itemTableColumns],
        body: itemTableRows,
        startY: currentY,
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [100, 116, 139] }, // Slate-500
    });
    // --- End Statistics Section ---

    // Save the PDF
    doc.save(`SalesReport_${getInputValue(selectedDate)}.pdf`);
  };

  return (
    <div id="sales-modal-overlay" className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div id="sales-modal-content" className="border bg-neutral-800 p-6 rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col text-white">
        <div id="sales-modal-header" className="flex justify-between items-center mb-4 flex-shrink-0 gap-4">
          <h2 className="text-xl md:text-2xl font-semibold text-white whitespace-nowrap">
            Sales Report:
          </h2>
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
             value={getInputValue(selectedDate)} // Use helper to get YYYY-MM-DD from UTC date
             className="opacity-0 w-0 h-0 absolute"
             aria-hidden="true"
           />
          <button
            onClick={handleExportPdf}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-800 whitespace-nowrap"
            title="Export Daily Report as PDF"
            disabled={isLoading || dailySales.length === 0}
          >
            Export PDF
          </button>
          <button
            onClick={onClose}
            className="text-red-500 hover:text-red-700 font-bold text-2xl leading-none flex-shrink-0"
            title="Close Sales Report"
          >
            &times;
          </button>
        </div>

        {isLoading && <div className="text-center text-neutral-400 py-8 flex-grow flex items-center justify-center">Loading sales data for {formatDateDisplay(selectedDate)}...</div>}
        {error && <div className="text-center text-red-500 py-8 flex-grow flex items-center justify-center">{error}</div>}

        {!isLoading && !error && dailySales.length === 0 && (
          <div className="text-center text-neutral-500 py-8 flex-grow flex items-center justify-center">No sales recorded on {formatDateDisplay(selectedDate)}.</div>
        )}

        {!isLoading && !error && dailySales.length > 0 && (
          <div id="sales-print-area" className="flex-grow overflow-y-auto overflow-x-auto pr-1">
            <table className="min-w-full bg-neutral-800">
              <thead className="bg-neutral-700 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">Username</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">Items</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-neutral-300 uppercase tracking-wider">Total Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {dailySales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-neutral-750">
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-200">{formatTime(sale.timestamp)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-200">{sale.username}</td>
                    <td className="px-4 py-2 text-sm text-neutral-200 align-top">
                      <ul className="space-y-1">
                        {sale.items.map((item, index) => (
                          <li key={item.id || index} className="text-xs">
                            {item.quantity} x {item.name} ({formatPrice(item.price)})
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-200 text-right font-medium">{formatPrice(sale.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 pt-4 border-t border-neutral-700 text-right pr-4">
              <span className="text-lg font-semibold text-neutral-300">Total for {formatDateDisplay(selectedDate)}: </span>
              <span className="text-xl font-bold text-green-400">{formatPrice(salesStats.totalSalesValue)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sales;
