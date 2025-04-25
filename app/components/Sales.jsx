// /home/krist/dev/ibean/app/components/Sales.jsx
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getFirestore, collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { auth } from '../../utils/firebase'; // Adjust path if needed
import { useAuthState } from 'react-firebase-hooks/auth';
import jsPDF from 'jspdf'; // Import jsPDF
import autoTable from 'jspdf-autotable'; // Import jspdf-autotable
import { useStore } from '../context/StoreContext';


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
  const { selectedStore, availableStores } = useStore(); 
  const [isExportingMonthly, setIsExportingMonthly] = useState(false);

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
      const fetchDataForDate = async (dateToFetch, storeName) => { // Renamed function for clarity
    
      
      if (!storeName) {
        setError("No store selected.");
        setIsLoading(false);
        setDailySales([]);
        setDailyRefunds([]);
        return;
      }
      setIsLoading(true);
      setError(null);
      setDailySales([]);
      setDailyRefunds([]);
      
      // 
      try {
        // --- Define Time Range ---
        const startOfDay = new Date(selectedDate); // Copy the UTC date
        const endOfDay = new Date(selectedDate);
        endOfDay.setUTCHours(23, 59, 59, 999); // Use setUTCHours
        const startTimestamp = Timestamp.fromDate(startOfDay);
        const endTimestamp = Timestamp.fromDate(endOfDay);

        // --- Fetch Sales for selected store ---
        const salesCollectionRef = collection(db, 'sales');
        const salesQuery = query(
          salesCollectionRef,
          where('storeName', '==', storeName), // *** Filter by storeName ***
          where('timestamp', '>=', startTimestamp),
          where('timestamp', '<=', endTimestamp),
          orderBy('timestamp', 'desc')
        );
        const salesSnapshot = await getDocs(salesQuery);
        const salesData = salesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
              id: doc.id,
              ...data,
              timestamp: data.timestamp ? data.timestamp.toDate() : undefined, // Convert to Date
              totalPrice: typeof data.totalPrice === 'number' ? data.totalPrice : parseFloat(String(data.totalPrice).replace(/[^\d.-]/g, '') || 0),
              items: Array.isArray(data.items) ? data.items : [],
          };
        });
        setDailySales(salesData);

        // --- Fetch Refunds for selected store ---
        const refundsCollectionRef = collection(db, 'refunds');
        const refundsQuery = query(
            refundsCollectionRef,
            where('storeName', '==', storeName), // *** Filter by storeName ***
            where('timestamp', '>=', startTimestamp),
            where('timestamp', '<=', endTimestamp),
            orderBy('timestamp', 'desc')
        );
        const refundsSnapshot = await getDocs(refundsQuery);
        const refundsData = refundsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
              id: doc.id,
              ...data,
              timestamp: data.timestamp ? data.timestamp.toDate() : undefined, // Convert to Date
              amount: typeof data.amount === 'number' ? data.amount : parseFloat(String(data.amount).replace(/[^\d.-]/g, '') || 0),
          };
        });
          setDailyRefunds(refundsData);
          } catch (err) {
            console.error("Error fetching daily data:", err);
            setError(`Failed to load data for ${formatDateDisplay(selectedDate)}. Please check console and try again.`);
          } finally {
            setIsLoading(false);
          }
      };

    fetchDataForDate(selectedDate, selectedStore);// Call the combined fetch function
  }, [db, selectedDate, selectedStore]); // Updated selectStore dependency


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
  const handleExportDailyPdf = () => {
    // Allow export even if only refunds exist for the day
    if (dailySales.length === 0 && dailyRefunds.length === 0) return;

    const doc = new jsPDF();
    const { totalSalesValue, totalNumberOfSales, totalItemsSoldCount, averageSaleValue, itemSummary } = salesStats;
    const { totalRefundsValue, totalNumberOfRefunds } = refundStats;
    const netSalesValue = totalSalesValue - totalRefundsValue;


    // --- PDF Title (Include Store Name) ---
    doc.setFontSize(18);
    doc.text(`Daily Report: ${selectedStore} - ${formatDateDisplay(selectedDate)}`, 14, 22); // Added store
    doc.setFontSize(11);
    let currentY = 30;

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

  // *** NEW Function: Generate and download Monthly PDF for ALL Stores ***
  const handleExportMonthlyPdfAllStores = async () => {
    setIsExportingMonthly(true);
    setError(null); // Clear previous errors

    try {
        // 1. Determine Month Range based on selectedDate
        const year = selectedDate.getUTCFullYear();
        const month = selectedDate.getUTCMonth(); // 0-indexed
        const startOfMonth = new Date(Date.UTC(year, month, 1));
        const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)); // Last day, end of day
        const startTimestamp = Timestamp.fromDate(startOfMonth);
        const endTimestamp = Timestamp.fromDate(endOfMonth);
        const monthYearStr = startOfMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

        // 2. Fetch ALL Sales and Refunds for the month (no store filter)
        const salesCollectionRef = collection(db, 'sales');
        const monthlySalesQuery = query(
            salesCollectionRef,
            where('timestamp', '>=', startTimestamp),
            where('timestamp', '<=', endTimestamp)
            // No storeName filter here!
            // orderBy('storeName').orderBy('timestamp') // Optional ordering
        );
        const monthlyRefundsQuery = query(
            collection(db, 'refunds'),
            where('timestamp', '>=', startTimestamp),
            where('timestamp', '<=', endTimestamp)
            // No storeName filter here!
        );

        const [salesSnapshot, refundsSnapshot] = await Promise.all([
            getDocs(monthlySalesQuery),
            getDocs(monthlyRefundsQuery)
        ]);

        const allMonthlySales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const allMonthlyRefunds = refundsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (allMonthlySales.length === 0 && allMonthlyRefunds.length === 0) {
            setError(`No sales or refunds found for any store in ${monthYearStr}.`);
            setIsExportingMonthly(false);
            return;
        }

        // 3. Process and Aggregate Data by Store
        const summaryByStore = {};
        availableStores.forEach(store => {
            summaryByStore[store] = {
                totalSalesValue: 0,
                totalRefundsValue: 0,
                netSalesValue: 0,
                salesCount: 0,
                refundsCount: 0,
            };
        });

        allMonthlySales.forEach(sale => {
            const store = sale.storeName;
            if (summaryByStore[store]) {
                const price = typeof sale.totalPrice === 'number' ? sale.totalPrice : 0;
                summaryByStore[store].totalSalesValue += price;
                summaryByStore[store].salesCount += 1;
            }
        });

        allMonthlyRefunds.forEach(refund => {
            const store = refund.storeName;
            if (summaryByStore[store]) {
                const amount = typeof refund.amount === 'number' ? refund.amount : 0;
                summaryByStore[store].totalRefundsValue += amount;
                summaryByStore[store].refundsCount += 1;
            }
        });

        // Calculate net sales and grand totals
        let grandTotalSales = 0;
        let grandTotalRefunds = 0;
        let grandNetSales = 0;

        availableStores.forEach(store => {
            const storeData = summaryByStore[store];
            storeData.netSalesValue = storeData.totalSalesValue - storeData.totalRefundsValue;
            grandTotalSales += storeData.totalSalesValue;
            grandTotalRefunds += storeData.totalRefundsValue;
            grandNetSales += storeData.netSalesValue;
        });


        // 4. Generate PDF
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Monthly Report (All Stores): ${monthYearStr}`, 14, 22);
        let currentY = 30;

        // Table for Store Summaries
        doc.setFontSize(14);
        doc.text("Summary by Store", 14, currentY);
        currentY += 6;

        const summaryTableColumns = ["Store", "Total Sales", "Total Refunds", "Net Sales", "# Sales", "# Refunds"];
        const summaryTableRows = availableStores.map(store => {
            const data = summaryByStore[store];
            return [
                store,
                formatPrice(data.totalSalesValue),
                formatPrice(data.totalRefundsValue),
                formatPrice(data.netSalesValue),
                data.salesCount.toString(),
                data.refundsCount.toString()
            ];
        });

        autoTable(doc, {
            head: [summaryTableColumns],
            body: summaryTableRows,
            startY: currentY,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 1.5 },
            headStyles: { fillColor: [75, 85, 99], fontSize: 10 },
            columnStyles: {
                0: { fontStyle: 'bold' }, // Store name bold
                1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
                4: { halign: 'center' }, 5: { halign: 'center' },
            }
        });
        currentY = doc.lastAutoTable.finalY + 10;

        // Grand Totals Section
        doc.setFontSize(12);
        doc.text("Grand Totals (All Stores):", 14, currentY);
        currentY += 6;

        const grandTotalData = [
            ['Total Sales Value:', formatPrice(grandTotalSales)],
            ['Total Refunds Value:', formatPrice(grandTotalRefunds)],
            ['Net Sales (All Stores):', formatPrice(grandNetSales)],
        ];

        autoTable(doc, {
            body: grandTotalData,
            startY: currentY,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 1 },
            columnStyles: {
                0: { fontStyle: 'bold', halign: 'left' },
                1: { halign: 'right' },
            },
            tableWidth: 'wrap',
            margin: { left: 14 }
        });

        // 5. Save PDF
        const monthStr = (month + 1).toString().padStart(2, '0');
        doc.save(`MonthlyReport_AllStores_${year}-${monthStr}.pdf`);

    } catch (err) {
        console.error("Error generating monthly report:", err);
        setError(`Failed to generate monthly report: ${err.message}`);
    } finally {
        setIsExportingMonthly(false);
    }
  };



  return (
    <div id="sales-modal-overlay" className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div id="sales-modal-content" className="border bg-neutral-800 p-6 rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col text-white">
        {/* Header remains the same */}
        <div id="sales-modal-header" className="flex justify-between items-center mb-4 flex-shrink-0 gap-4">
          <h2 className="text-xl md:text-2xl font-semibold text-white whitespace-nowrap">
            Daily Report: {selectedStore} {/* Changed title slightly */}
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

          {/* Buttons Container */}
          <div className="flex gap-2 order-2 md:order-none">
             {/* Daily Export Button */}
             <button
               onClick={handleExportDailyPdf}
               className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-800 whitespace-nowrap disabled:opacity-50"
               title={`Export Daily Report for ${selectedStore}`}
               disabled={isLoading || (dailySales.length === 0 && dailyRefunds.length === 0)}
             >
               Export Daily PDF
             </button>
             {/* Monthly Export Button */}
             <button
               onClick={handleExportMonthlyPdfAllStores}
               className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-white text-xs md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-neutral-800 whitespace-nowrap disabled:opacity-50"
               title="Export Monthly Report (All Stores)"
               disabled={isExportingMonthly || isLoading} // Disable while loading daily or exporting monthly
             >
               {isExportingMonthly ? 'Exporting...' : 'Export Monthly PDF'}
             </button>
          </div>


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
