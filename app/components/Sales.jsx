// /home/krist/dev/ibean/app/components/Sales.jsx
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
  const [dailyRefunds, setDailyRefunds] = useState([]); // *** State for daily refunds ***
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

  // Format price/amount (used for both sales and refunds)
  const formatPrice = (price) => {
    const numericPrice = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^\d.-]/g, '') || 0);
    return `R ${numericPrice.toFixed(2)}`;
  };

  // Format time (used for both sales and refunds)
  const formatTime = (date) => {
    // Time formatting can remain local as it displays the time part of the timestamp
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  useEffect(() => {
    const fetchDataForDate = async () => { // Renamed function for clarity
      setIsLoading(true);
      setError(null);
      setDailySales([]);
      setDailyRefunds([]); // *** Clear previous refunds ***

      try {
        // --- Define Time Range ---
        const startOfDay = new Date(selectedDate); // Copy the UTC date
        const endOfDay = new Date(selectedDate);
        endOfDay.setUTCHours(23, 59, 59, 999); // Use setUTCHours
        const startTimestamp = Timestamp.fromDate(startOfDay);
        const endTimestamp = Timestamp.fromDate(endOfDay);

        // --- Fetch Sales ---
        const salesCollectionRef = collection(db, 'sales');
        const salesQuery = query(
          salesCollectionRef,
          where('timestamp', '>=', startTimestamp),
          where('timestamp', '<=', endTimestamp),
          orderBy('timestamp', 'desc')
        );
        const salesSnapshot = await getDocs(salesQuery);
        const salesData = salesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          totalPrice: typeof doc.data().totalPrice === 'number' ? doc.data().totalPrice : parseFloat(String(doc.data().totalPrice).replace(/[^\d.-]/g, '') || 0),
          items: Array.isArray(doc.data().items) ? doc.data().items : [],
          timestamp: doc.data().timestamp.toDate(),
        }));
        setDailySales(salesData);

        // --- Fetch Refunds ---
        const refundsCollectionRef = collection(db, 'refunds'); // *** Use 'refunds' collection ***
        const refundsQuery = query(
          refundsCollectionRef,
          where('timestamp', '>=', startTimestamp),
          where('timestamp', '<=', endTimestamp),
          orderBy('timestamp', 'desc') // Order refunds as well
        );
        const refundsSnapshot = await getDocs(refundsQuery);
        const refundsData = refundsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Ensure amount is a number when fetching
          amount: typeof doc.data().amount === 'number' ? doc.data().amount : parseFloat(String(doc.data().amount).replace(/[^\d.-]/g, '') || 0),
          timestamp: doc.data().timestamp.toDate(),
        }));
        setDailyRefunds(refundsData); // *** Set refund state ***

      } catch (err) {
        console.error("Error fetching daily data:", err);
        setError(`Failed to load data for ${formatDateDisplay(selectedDate)}. Please check console and try again.`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDataForDate(); // Call the combined fetch function
  }, [db, selectedDate]); // Dependencies remain the same

  // Calculate sales summary statistics using useMemo
  const salesStats = useMemo(() => {
    const totalSalesValue = dailySales.reduce((sum, sale) => {
      const price = typeof sale.totalPrice === 'number' ? sale.totalPrice : 0;
      return sum + price;
    }, 0);
    const totalNumberOfSales = dailySales.length;
    const itemSummary = {};
    let totalItemsSoldCount = 0;
    dailySales.forEach(sale => {
        if (Array.isArray(sale.items)) {
            sale.items.forEach(item => {
                const itemName = item.name || 'Unknown Item';
                const quantity = typeof item.quantity === 'number' ? item.quantity : 0;
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

  // *** Calculate refund summary statistics using useMemo ***
  const refundStats = useMemo(() => {
    const totalRefundsValue = dailyRefunds.reduce((sum, refund) => {
      const amount = typeof refund.amount === 'number' ? refund.amount : 0;
      return sum + amount;
    }, 0);
    const totalNumberOfRefunds = dailyRefunds.length;
    return {
      totalRefundsValue,
      totalNumberOfRefunds,
    };
  }, [dailyRefunds]); // Depends on dailyRefunds

  // Handle date change ensuring the new date is UTC midnight
  const handleDateChange = (event) => {
    const dateValue = event.target.value; // "YYYY-MM-DD"
    if (dateValue) {
        const [year, month, day] = dateValue.split('-').map(Number);
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
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  // Function to generate and download PDF with stats including refunds
  const handleExportPdf = () => {
    // Allow export even if only refunds exist for the day
    if (dailySales.length === 0 && dailyRefunds.length === 0) return;

    const doc = new jsPDF();
    const {
        totalSalesValue,
        totalNumberOfSales,
        totalItemsSoldCount,
        averageSaleValue,
        itemSummary
    } = salesStats;
    const { totalRefundsValue, totalNumberOfRefunds } = refundStats; // *** Get refund stats ***
    const netSalesValue = totalSalesValue - totalRefundsValue; // *** Calculate Net Sales ***

    // --- PDF Title ---
    doc.setFontSize(18);
    doc.text(`Daily Report: ${formatDateDisplay(selectedDate)}`, 14, 22);
    doc.setFontSize(11);
    let currentY = 30; // Start position for content

    // --- Sales Table ---
    if (dailySales.length > 0) {
        doc.setFontSize(14);
        doc.text("Sales Transactions", 14, currentY);
        currentY += 6;
        const salesTableColumns = ["Time", "Username", "Items", "Total Price"];
        const salesTableRows = dailySales.map(sale => {
            const itemsString = sale.items.map(item =>
                `${item.quantity || 0} x ${item.name || '?'} (${formatPrice(item.price || 0)})`
            ).join("\n");
            return [
                formatTime(sale.timestamp),
                sale.username,
                itemsString,
                formatPrice(sale.totalPrice)
            ];
        });

        autoTable(doc, {
            head: [salesTableColumns],
            body: salesTableRows,
            startY: currentY,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
            headStyles: { fillColor: [75, 85, 99], fontSize: 9 }, // Neutral-700
            columnStyles: {
                0: { cellWidth: 18 }, 1: { cellWidth: 30 }, 2: { cellWidth: 'auto' }, 3: { halign: 'right', cellWidth: 25 },
            }
        });
        currentY = doc.lastAutoTable.finalY + 10; // Update Y position below the table
    } else {
        doc.setFontSize(10);
        doc.setTextColor(150); // Grey text
        doc.text("No sales transactions recorded for this day.", 14, currentY);
        doc.setTextColor(0); // Reset text color
        currentY += 10;
    }


    // --- Refunds Table (Optional) ---
    if (dailyRefunds.length > 0) {
        doc.setFontSize(14);
        doc.text("Refund Transactions", 14, currentY);
        currentY += 6;
        const refundTableColumns = ["Time", "Username", "Reason", "Amount"];
        const refundTableRows = dailyRefunds.map(refund => [
            formatTime(refund.timestamp),
            refund.username || 'N/A', // Handle potential missing username
            refund.reason || 'N/A',   // Handle potential missing reason
            formatPrice(refund.amount) // Format refund amount
        ]);

        autoTable(doc, {
            head: [refundTableColumns],
            body: refundTableRows,
            startY: currentY,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
            headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontSize: 9 }, // Red-700 bg, white text
            columnStyles: {
                0: { cellWidth: 18 }, 1: { cellWidth: 30 }, 2: { cellWidth: 'auto' }, 3: { halign: 'right', cellWidth: 25 },
            },
            // Example: Styling refund amounts in red (optional, requires more complex cell hooks)
            // didParseCell: function (data) {
            //     if (data.column.index === 3 && data.cell.section === 'body') {
            //         data.cell.styles.textColor = [220, 38, 38]; // Red text for amount
            //     }
            // }
        });
        currentY = doc.lastAutoTable.finalY + 10; // Update Y position
    }
    // No need for an "else" here, if no refunds, the section is just skipped.


    // --- Daily Summary Section ---
    doc.setFontSize(12);
    doc.text("Daily Summary:", 14, currentY);
    currentY += 6;
    doc.setFontSize(10);

    // Summary Stats Table (using autoTable for better alignment)
    const summaryData = [
        ['Total Sales Value:', formatPrice(totalSalesValue)],
        ['Total Refunds Value:', formatPrice(totalRefundsValue)], // *** Add Total Refunds ***
        ['Net Sales (Sales - Refunds):', formatPrice(netSalesValue)], // *** Add Net Sales ***
        ['Total Sales Transactions:', totalNumberOfSales.toString()],
        ['Total Refund Transactions:', totalNumberOfRefunds.toString()], // *** Add Refund Count ***
        ['Total Items Sold:', totalItemsSoldCount.toString()],
        ['Average Sale Value:', formatPrice(averageSaleValue)],
    ];

    autoTable(doc, {
        body: summaryData,
        startY: currentY,
        theme: 'plain', // No lines, just text
        styles: { fontSize: 10, cellPadding: 1 },
        columnStyles: {
            0: { fontStyle: 'bold', halign: 'left' }, // Label column
            1: { halign: 'right' }, // Value column
        },
        tableWidth: 'wrap', // Adjust table width to content
        margin: { left: 14 } // Indent the summary table slightly
    });
    currentY = doc.lastAutoTable.finalY + 10;


    // --- Item Summary Table ---
    if (Object.keys(itemSummary).length > 0) {
        doc.setFontSize(11);
        doc.text("Item Sales Summary:", 14, currentY);
        currentY += 6;
        const itemTableColumns = ["Item Name", "Quantity Sold"];
        const itemTableRows = Object.entries(itemSummary)
                                 .sort(([, qtyA], [, qtyB]) => qtyB - qtyA)
                                 .map(([name, quantity]) => [name, quantity]);

        autoTable(doc, {
            head: [itemTableColumns],
            body: itemTableRows,
            startY: currentY,
            theme: 'striped',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [100, 116, 139] }, // Slate-500
            margin: { left: 14 }
        });
        // currentY = doc.lastAutoTable.finalY; // Update Y if needed later
    }

    // --- Save the PDF ---
    doc.save(`DailyReport_${getInputValue(selectedDate)}.pdf`);
  };

  return (
    <div id="sales-modal-overlay" className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div id="sales-modal-content" className="border bg-neutral-800 p-6 rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col text-white">
        {/* Header remains the same */}
        <div id="sales-modal-header" className="flex justify-between items-center mb-4 flex-shrink-0 gap-4">
          <h2 className="text-xl md:text-2xl font-semibold text-white whitespace-nowrap">
            Daily Report: {/* Changed title slightly */}
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
             value={getInputValue(selectedDate)}
             className="opacity-0 w-0 h-0 absolute"
             aria-hidden="true"
           />
          <button
            onClick={handleExportPdf}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-800 whitespace-nowrap disabled:opacity-50"
            title="Export Daily Report as PDF"
            disabled={isLoading || (dailySales.length === 0 && dailyRefunds.length === 0)} // Disable if no data at all
          >
            Export PDF
          </button>
          <button
            onClick={onClose}
            className="text-red-500 hover:text-red-700 font-bold text-2xl leading-none flex-shrink-0"
            title="Close Report"
          >
            &times;
          </button>
        </div>

        {/* Loading/Error/No Data States */}
        {isLoading && <div className="text-center text-neutral-400 py-8 flex-grow flex items-center justify-center">Loading data for {formatDateDisplay(selectedDate)}...</div>}
        {error && <div className="text-center text-red-500 py-8 flex-grow flex items-center justify-center">{error}</div>}
        {!isLoading && !error && dailySales.length === 0 && dailyRefunds.length === 0 && (
          <div className="text-center text-neutral-500 py-8 flex-grow flex items-center justify-center">No sales or refunds recorded on {formatDateDisplay(selectedDate)}.</div>
        )}

        {/* Data Display Area (Sales Table - Refunds are only in PDF for now) */}
        {!isLoading && !error && (dailySales.length > 0 || dailyRefunds.length > 0) && ( // Show if either sales OR refunds exist
          <div id="sales-display-area" className="flex-grow overflow-y-auto overflow-x-auto pr-1">
            {/* Only display Sales table in the UI, refunds are added to PDF */}
            {dailySales.length > 0 ? (
              <>
                <h3 className="text-lg font-semibold mb-2 text-neutral-300">Sales Transactions</h3>
                <table className="min-w-full bg-neutral-800 mb-6">
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
                  <span className="text-lg font-semibold text-neutral-300">Total Sales for {formatDateDisplay(selectedDate)}: </span>
                  <span className="text-xl font-bold text-green-400">{formatPrice(salesStats.totalSalesValue)}</span>
                </div>
              </>
            ) : (
              <p className="text-center text-neutral-400 py-4">No sales transactions for this day.</p> // Message if only refunds exist
            )}
            {/* Optionally, you could display the refund total here too */}
             {dailyRefunds.length > 0 && (
                 <div className="mt-4 pt-4 border-t border-neutral-700 text-right pr-4">
                    <span className="text-lg font-semibold text-neutral-300">Total Refunds for {formatDateDisplay(selectedDate)}: </span>
                    <span className="text-xl font-bold text-red-400">{formatPrice(refundStats.totalRefundsValue)}</span>
                 </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sales;
