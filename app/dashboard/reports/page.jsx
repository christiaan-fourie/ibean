'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore'; // Timestamp might still be needed for date conversion from Firestore
import db from '../../../utils/firebase'; // Assuming db is your Firestore instance
import { auth } from '../../../utils/firebase'; // Assuming auth is your Firebase Auth instance
import { useAuthState } from 'react-firebase-hooks/auth';
import RouteGuard from '../../components/RouteGuard'; // Your existing RouteGuard

// Helper to get the start of a day from a YYYY-MM-DD string
const getStartOfDayFromString = (dateString) => {
    const date = new Date(dateString);
    date.setUTCHours(0, 0, 0, 0); // Use UTC to avoid timezone shifts from string
    return date;
};

// Helper to get the end of a day from a YYYY-MM-DD string
const getEndOfDayFromString = (dateString) => {
    const date = new Date(dateString);
    date.setUTCHours(23, 59, 59, 999); // Use UTC
    return date;
};


export default function Exports() {
    const [user, loadingAuth, errorAuth] = useAuthState(auth);
    const [staffAuth, setStaffAuth] = useState(null);

    // State to hold ALL data fetched from Firestore (unfiltered)
    const [masterData, setMasterData] = useState({
        sales: [],
        products: [],
        specials: [],
        staff: [],
        vouchers: [],
        refunds: [],
    });

    // State to hold client-side filtered data based on dateRange and selectedStore
    const [filteredData, setFilteredData] = useState({
        sales: [],
        refunds: [],
        // products, specials, etc., are usually not filtered this way, so they can come from masterData directly if needed by calcs
    });

    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    });

    const [stores] = useState([
        { id: 'zeven@iclick.co.za', name: 'Zevenwacht Mall' },
        { id: 'westgate@iclick.co.za', name: 'Westgate Mall' },
    ]);

    const [salesTotals, setSalesTotals] = useState({});
    const [staffTotals, setStaffTotals] = useState([]);
    const [refundTotals, setRefundTotals] = useState([]);
    const [calculatedStats, setCalculatedStats] = useState({
        peakHour: 'N/A', bestDay: 'N/A', topPaymentMethod: 'N/A',
        refundRate: '0.0', avgItemsPerSale: '0.0', revenuePerHour: 0,
        totalSalesValue: 0, totalRefundsValue: 0, totalTransactions: 0,
    });

    const [selectedStore, setSelectedStore] = useState('All stores');
    const [loading, setLoading] = useState(false); // Combined loading state
    const [error, setError] = useState('');

    useEffect(() => {
        const storedAuth = localStorage.getItem('staffAuth');
        if (storedAuth) {
            try {
                setStaffAuth(JSON.parse(storedAuth));
            } catch (e) {
                console.error("Failed to parse staffAuth from localStorage", e);
            }
        }
    }, []);

    // Fetch ALL data from Firestore
    const fetchAllMasterData = useCallback(async () => {
        if (!user && !loadingAuth) {
            setError("Please log in to view reports.");
            setMasterData({ sales: [], products: [], specials: [], staff: [], vouchers: [], refunds: [] });
            return;
        }
        if (errorAuth) {
            setError(`Authentication error: ${errorAuth.message}`);
            return;
        }

        setLoading(true);
        setError('');
        try {
            const collectionsToFetch = [
                { name: 'sales', stateKey: 'sales' },
                { name: 'products', stateKey: 'products' },
                { name: 'specials', stateKey: 'specials' },
                { name: 'staff', stateKey: 'staff' },
                { name: 'vouchers', stateKey: 'vouchers' },
                { name: 'refunds', stateKey: 'refunds' },
            ];

            const fetchedData = {};
            for (const { name, stateKey } of collectionsToFetch) {
                const snapshot = await getDocs(collection(db, name));
                fetchedData[stateKey] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            setMasterData(currentMasterData => ({...currentMasterData, ...fetchedData}));

        } catch (err) {
            console.error('Error fetching master data:', err);
            setError(`Failed to fetch master data: ${err.message}.`);
            setMasterData({ sales: [], products: [], specials: [], staff: [], vouchers: [], refunds: [] });
        } finally {
            // setLoading(false) will be handled after initial filtering and calculations
        }
    }, [user, loadingAuth, errorAuth]);

    // Effect to fetch master data when user is available
    useEffect(() => {
        if (user || !loadingAuth) { // Fetch if user is loaded or auth process is complete
            fetchAllMasterData();
        }
    }, [user, loadingAuth, fetchAllMasterData]);


    // Effect to filter masterData when it, selectedStore, or dateRange changes
    useEffect(() => {
        setLoading(true); // Start loading indicator for filtering/processing

        const startDate = getStartOfDayFromString(dateRange.start);
        const endDate = getEndOfDayFromString(dateRange.end);

        const newFilteredSales = masterData.sales.filter(sale => {
            // Assuming sale.date is a string 'YYYY-MM-DD' or Firestore Timestamp
            let saleDate;
            if (sale.date && sale.date.toDate) { // Firestore Timestamp
                saleDate = sale.date.toDate();
            } else if (typeof sale.date === 'string') { // Date string
                saleDate = getStartOfDayFromString(sale.date); // Compare consistently
            } else if (sale.timestamp && sale.timestamp.toDate) { // Fallback to 'timestamp' field
                 saleDate = sale.timestamp.toDate();
            } else if (typeof sale.timestamp === 'string') {
                 saleDate = getStartOfDayFromString(sale.timestamp);
            }
             else {
                // console.warn('Sale item missing valid date field:', sale);
                return false; // Skip if no valid date
            }
            
            const storeMatch = selectedStore === 'All stores' || sale.storeEmail === selectedStore;
            const dateMatch = saleDate >= startDate && saleDate <= endDate;
            return storeMatch && dateMatch;
        });

        const newFilteredRefunds = masterData.refunds.filter(refund => {
            let refundDate;
            if (refund.date && refund.date.toDate) {
                refundDate = refund.date.toDate();
            } else if (typeof refund.date === 'string') {
                refundDate = getStartOfDayFromString(refund.date);
            } else if (refund.timestamp && refund.timestamp.toDate) { // Fallback to 'timestamp' field
                 refundDate = refund.timestamp.toDate();
            } else if (typeof refund.timestamp === 'string') {
                 refundDate = getStartOfDayFromString(refund.timestamp);
            }
            else {
                // console.warn('Refund item missing valid date field:', refund);
                return false;
            }

            const storeMatch = selectedStore === 'All stores' || refund.storeId === selectedStore;
            const dateMatch = refundDate >= startDate && refundDate <= endDate;
            return storeMatch && dateMatch;
        });
        
        setFilteredData({
            sales: newFilteredSales,
            refunds: newFilteredRefunds,
        });

        // Note: The next useEffect will handle calculations with this new filteredData
        // setLoading(false) will be managed in the calculation useEffect
    }, [masterData, selectedStore, dateRange]);


    // Calculation functions (assuming these are defined as before, using useCallback)
    // Process Sales for Table 1
    const calculateProductPaymentTotals = useCallback((salesData) => {
        const productTotals = {};
        salesData.forEach(sale => {
            const paymentMethod = sale.payment?.method?.toLowerCase() || 'unknown';
            sale.items.forEach(item => {
                const productName = item.name || 'Unknown Product';
                const subtotal = parseFloat(item.subtotal) || 0;
                if (!productTotals[productName]) {
                    productTotals[productName] = { Product: productName, Cash: 0, Card: 0, Snapscan: 0, Other: 0, Total: 0 };
                }
                switch (paymentMethod) {
                    case 'cash': productTotals[productName].Cash += subtotal; break;
                    case 'card': productTotals[productName].Card += subtotal; break;
                    case 'snapscan': productTotals[productName].Snapscan += subtotal; break;
                    default: productTotals[productName].Other += subtotal; break;
                }
                productTotals[productName].Total += subtotal;
            });
        });
        return productTotals;
    }, []);

    const calculateRefundTotals = useCallback((refundData) => {
        return refundData.map(refund => ({
            staffName: refund.staffName || 'Unknown',
            item: refund.item || 'Unknown Item',
            method: refund.method || 'Unknown Method',
            reason: refund.reason || 'No reason provided',
            amount: parseFloat(refund.amount) || 0,
        }));
    }, []);

    const calculateStaffTotals = useCallback((salesData) => {
        const staffPerformance = {};
        salesData.forEach(sale => {
            const staffName = sale.staffName || 'Unknown Staff';
            const saleTotal = parseFloat(sale.total) || 0;
            const itemsInSale = sale.items || [];

            if (!staffPerformance[staffName]) {
                staffPerformance[staffName] = {
                    staffName, transactions: 0, total: 0, allItemsSold: [],
                };
            }
            staffPerformance[staffName].transactions += 1;
            staffPerformance[staffName].total += saleTotal;
            itemsInSale.forEach(item => {
                staffPerformance[staffName].allItemsSold.push({ name: item.name, quantity: item.quantity || 1});
            });
        });

        return Object.values(staffPerformance).map(staff => {
            const productCounts = staff.allItemsSold.reduce((acc, item) => {
                acc[item.name] = (acc[item.name] || 0) + item.quantity; return acc;
            }, {});
            let mostPopularProduct = 'N/A'; let maxCount = 0;
            for (const productName in productCounts) {
                if (productCounts[productName] > maxCount) {
                    mostPopularProduct = productName; maxCount = productCounts[productName];
                }
            }
            return {
                ...staff,
                averageSale: staff.transactions > 0 ? staff.total / staff.transactions : 0,
                mostPopularProduct: mostPopularProduct,
            };
        });
    }, []);
    
    const calculateAdditionalStats = useCallback((salesData, refundData) => {
        if (!salesData || salesData.length === 0) {
            return {
                peakHour: 'N/A', bestDay: 'N/A', topPaymentMethod: 'N/A',
                refundRate: '0.0', avgItemsPerSale: '0.0', revenuePerHour: 0,
                totalSalesValue: 0, totalRefundsValue: 0, totalTransactions: 0,
            };
        }
        const hourlySales = {}; const dailySalesValue = {}; const paymentMethodsCount = {};
        let totalItemsSold = 0; let currentTotalSalesValue = 0; const distinctSaleHours = new Set();

        salesData.forEach(sale => {
            let saleDate;
             if (sale.date && sale.date.toDate) { saleDate = sale.date.toDate(); }
             else if (typeof sale.date === 'string') { saleDate = new Date(sale.date); } // More direct conversion if it's a full ISO string
             else if (sale.timestamp && sale.timestamp.toDate) { saleDate = sale.timestamp.toDate(); }
             else if (typeof sale.timestamp === 'string') { saleDate = new Date(sale.timestamp); }
             else { saleDate = new Date(); /* fallback, less ideal */ }


            const hour = saleDate.getHours(); // Use local time from converted date
            hourlySales[hour] = (hourlySales[hour] || 0) + 1;
            distinctSaleHours.add(hour);

            const day = saleDate.toLocaleDateString('en-US', { weekday: 'long' });
            dailySalesValue[day] = (dailySalesValue[day] || 0) + (parseFloat(sale.total) || 0);

            const paymentMethod = sale.payment?.method?.toLowerCase() || 'unknown';
            paymentMethodsCount[paymentMethod] = (paymentMethodsCount[paymentMethod] || 0) + 1;

            sale.items.forEach(item => totalItemsSold += (item.quantity || 1));
            currentTotalSalesValue += (parseFloat(sale.total) || 0);
        });

        const peakHourVal = Object.keys(hourlySales).length > 0 ? Object.keys(hourlySales).reduce((a, b) => hourlySales[a] > hourlySales[b] ? a : b) : 'N/A';
        const bestDayVal = Object.keys(dailySalesValue).length > 0 ? Object.keys(dailySalesValue).reduce((a, b) => dailySalesValue[a] > dailySalesValue[b] ? a : b) : 'N/A';
        const topPaymentMethodVal = Object.keys(paymentMethodsCount).length > 0 ? Object.keys(paymentMethodsCount).reduce((a, b) => paymentMethodsCount[a] > paymentMethodsCount[b] ? a : b) : 'N/A';
        
        let currentTotalRefundsValue = 0;
        refundData.forEach(refund => currentTotalRefundsValue += (parseFloat(refund.amount) || 0));

        const refundRateVal = currentTotalSalesValue > 0 ? ((currentTotalRefundsValue / currentTotalSalesValue) * 100).toFixed(1) : '0.0';
        const avgItemsPerSaleVal = salesData.length > 0 ? (totalItemsSold / salesData.length).toFixed(1) : '0.0';
        const revenuePerHourVal = distinctSaleHours.size > 0 ? currentTotalSalesValue / distinctSaleHours.size : 0;

        return {
            peakHour: peakHourVal !== 'N/A' ? `${peakHourVal.padStart(2,'0')}:00 - ${String(parseInt(peakHourVal, 10) + 1).padStart(2, '0')}:00` : 'N/A',
            bestDay: bestDayVal, topPaymentMethod: topPaymentMethodVal, refundRate: refundRateVal, avgItemsPerSale: avgItemsPerSaleVal,
            revenuePerHour: revenuePerHourVal, totalSalesValue: currentTotalSalesValue, totalRefundsValue: currentTotalRefundsValue, totalTransactions: salesData.length,
        };
    }, []);


    // Effect for processing data when filteredData changes
    useEffect(() => {
        // setLoading(true) should have been set by the filtering useEffect
        if (filteredData.sales && filteredData.refunds) {
            setSalesTotals(calculateProductPaymentTotals(filteredData.sales));
            setRefundTotals(calculateRefundTotals(filteredData.refunds));
            setStaffTotals(calculateStaffTotals(filteredData.sales));
            setCalculatedStats(calculateAdditionalStats(filteredData.sales, filteredData.refunds));
        } else {
            setSalesTotals({}); setRefundTotals([]); setStaffTotals([]);
            setCalculatedStats({ /* initial empty stats */ });
        }
        setLoading(false); // All data fetching, filtering, and calculations are done
    }, [filteredData, calculateProductPaymentTotals, calculateRefundTotals, calculateStaffTotals, calculateAdditionalStats]);


    const handleStoreChange = (e) => setSelectedStore(e.target.value);
    const handleDateChange = (e, type) => setDateRange(prev => ({ ...prev, [type]: e.target.value }));
    

    if (loadingAuth && !user) { // Only show auth loading if user isn't already available
        return <div className="min-h-screen bg-neutral-900 p-8 text-white text-center">Loading authentication...</div>;
    }
    
    return (
        <RouteGuard requiredRoles={['manager']} currentRole={staffAuth?.accountType}>
            <div className="min-h-screen bg-neutral-900 p-4 md:p-8">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-3xl font-bold text-white mb-8 text-center md:text-left">Chillzone Reports</h1>

                    <div className="bg-neutral-800 p-6 rounded-lg shadow-lg mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            {staffAuth?.accountType === 'manager' && (
                                <div>
                                    <label htmlFor="storeSelect" className="block text-sm font-medium text-neutral-300 mb-1">Select Store</label>
                                    <select id="storeSelect" value={selectedStore} onChange={handleStoreChange} className="w-full p-2 bg-neutral-700 rounded text-white focus:ring-green-500 focus:border-green-500">
                                        <option value="All stores">All stores</option>
                                        {stores.map(store => (<option key={store.id} value={store.id}>{store.name}</option>))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label htmlFor="startDate" className="block text-sm font-medium text-neutral-300 mb-1">Start Date</label>
                                <input id="startDate" type="date" value={dateRange.start} onChange={(e) => handleDateChange(e, 'start')} className="w-full p-2 bg-neutral-700 rounded text-white focus:ring-green-500 focus:border-green-500" />
                            </div>
                            <div>
                                <label htmlFor="endDate" className="block text-sm font-medium text-neutral-300 mb-1">End Date</label>
                                <input id="endDate" type="date" value={dateRange.end} onChange={(e) => handleDateChange(e, 'end')} className="w-full p-2 bg-neutral-700 rounded text-white focus:ring-green-500 focus:border-green-500" />
                            </div>
                        </div>
                        {error && (<div className="mt-4 p-3 bg-red-600/30 border border-red-500 rounded text-white text-sm">{error}</div>)}
                        {loading && (<div className="mt-4 p-3 bg-blue-600/30 border border-blue-500 rounded text-white text-sm">Loading and processing data... Please wait.</div>)}
                    </div>
                    
                    {!loading && !error && (
                        <div className="p-4 md:p-6 bg-neutral-800 rounded-lg shadow-lg">
                            <h2 className="text-xl font-bold text-white mb-4">
                                Analysis Report: <span className='rounded-lg bg-neutral-900 p-2 text-green-500'>{stores.find(s => s.id === selectedStore)?.name || selectedStore}</span>
                                <span className="text-sm text-neutral-400 block md:inline md:ml-2">
                                    ({new Date(dateRange.start + 'T00:00:00').toLocaleDateString()} - {new Date(dateRange.end + 'T00:00:00').toLocaleDateString()}) {/* Ensure date is parsed correctly for display */}
                                </span>
                            </h2>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 text-neutral-300">
                                <div className="bg-neutral-700 p-4 rounded-lg"><strong>Total Transactions:</strong> {calculatedStats.totalTransactions}</div>
                                <div className="bg-neutral-700 p-4 rounded-lg"><strong>Total Sales Value:</strong> R{calculatedStats.totalSalesValue.toFixed(2)}</div>
                                <div className="bg-neutral-700 p-4 rounded-lg"><strong>Total Refunds Value:</strong> R{calculatedStats.totalRefundsValue.toFixed(2)}</div>
                            </div>

                            {/* Table 1: Product Sales */}
                            <div className="mt-6">
                                <h3 className='rounded-t-lg bg-neutral-900 p-3 text-lg font-semibold text-green-500'>Product Sales Summary</h3>
                                {Object.keys(salesTotals).length > 0 ? (
                                    <div className="overflow-x-auto"><table className="min-w-full bg-neutral-800 border border-neutral-700 text-green-500">
                                        <thead><tr className="bg-neutral-700">
                                            <th className="px-4 py-2 text-left text-sm">Product</th><th className="px-4 py-2 text-left text-sm">Cash</th>
                                            <th className="px-4 py-2 text-left text-sm">Card</th><th className="px-4 py-2 text-left text-sm">SnapScan</th>
                                            <th className="px-4 py-2 text-left text-sm">Other</th><th className="px-4 py-2 text-left text-sm">Total</th>
                                        </tr></thead>
                                        <tbody>{Object.values(salesTotals).sort((a,b) => b.Total - a.Total).map((sale, index) => (
                                            <tr key={index} className="border-b border-neutral-700 hover:bg-neutral-700/50">
                                                <td className="px-4 py-2 text-neutral-300 text-sm">{sale.Product}</td>
                                                <td className="px-4 py-2 text-neutral-300 text-sm">R{sale.Cash.toFixed(2)}</td>
                                                <td className="px-4 py-2 text-neutral-300 text-sm">R{sale.Card.toFixed(2)}</td>
                                                <td className="px-4 py-2 text-neutral-300 text-sm">R{sale.Snapscan.toFixed(2)}</td>
                                                <td className="px-4 py-2 text-neutral-300 text-sm">R{sale.Other.toFixed(2)}</td>
                                                <td className="px-4 py-2 text-neutral-300 text-sm font-semibold">R{sale.Total.toFixed(2)}</td>
                                            </tr>))}</tbody>
                                    </table></div>
                                ) : (<p className="text-neutral-400 p-3">No product sales data for this period/store.</p>)}
                            </div>

                            {/* Table 2: Refunds */}
                            <div className="mt-8">
                                <h3 className='rounded-t-lg bg-neutral-900 p-3 text-lg font-semibold text-red-500'>Refunds Issued</h3>
                                {refundTotals.length > 0 ? (
                                    <div className="overflow-x-auto"><table className="min-w-full bg-neutral-800 border border-neutral-700 text-red-500">
                                        <thead><tr className="bg-neutral-700">
                                            <th className="px-4 py-2 text-left text-sm">Staff</th><th className="px-4 py-2 text-left text-sm">Item</th>
                                            <th className="px-4 py-2 text-left text-sm">Method</th><th className="px-4 py-2 text-left text-sm">Reason</th>
                                            <th className="px-4 py-2 text-left text-sm">Amount</th>
                                        </tr></thead>
                                        <tbody>{refundTotals.map((refund, index) => (
                                            <tr key={index} className="border-b border-neutral-700 hover:bg-neutral-700/50">
                                                <td className="px-4 py-2 text-neutral-300 text-sm">{refund.staffName}</td>
                                                <td className="px-4 py-2 text-neutral-300 text-sm">{refund.item}</td>
                                                <td className="px-4 py-2 text-neutral-300 text-sm">{refund.method}</td>
                                                <td className="px-4 py-2 text-neutral-300 text-sm">{refund.reason}</td>
                                                <td className="px-4 py-2 text-neutral-300 text-sm">R{refund.amount.toFixed(2)}</td>
                                            </tr>))}</tbody>
                                    </table></div>
                                ) : (<p className="text-neutral-400 p-3">No refunds issued for this period/store.</p>)}
                            </div>

                            {/* Table 3: Crew Performance */}
                            <div className="mt-8">
                                <h3 className='rounded-t-lg bg-neutral-900 p-3 text-lg font-semibold text-blue-400'>Crew Performance</h3>
                                {staffTotals.length > 0 ? (
                                    <div className="overflow-x-auto"><table className="min-w-full bg-neutral-800 border border-neutral-700 text-blue-400">
                                        <thead><tr className="bg-neutral-700">
                                            <th className="px-4 py-2 text-left text-sm">Staff</th><th className="px-4 py-2 text-left text-sm">Transactions</th>
                                            <th className="px-4 py-2 text-left text-sm">Avg Sale</th><th className="px-4 py-2 text-left text-sm">Total Sales</th>
                                            <th className="px-4 py-2 text-left text-sm">Most Sold</th>
                                        </tr></thead>
                                        <tbody>{staffTotals.sort((a,b) => b.total - a.total).map((staff, index) => (
                                            <tr key={index} className="border-b border-neutral-700 hover:bg-neutral-700/50">
                                                <td className="px-4 py-2 text-neutral-300 text-sm">{staff.staffName}</td>
                                                <td className="px-4 py-2 text-neutral-300 text-sm">{staff.transactions}</td>
                                                <td className="px-4 py-2 text-neutral-300 text-sm">R{staff.averageSale.toFixed(2)}</td>
                                                <td className="px-4 py-2 text-neutral-300 text-sm">R{staff.total.toFixed(2)}</td>
                                                <td className="px-4 py-2 text-neutral-300 text-sm">{staff.mostPopularProduct}</td>
                                            </tr>))}</tbody>
                                    </table></div>
                                ) : (<p className="text-neutral-400 p-3">No staff performance data for this period/store.</p>)}
                            </div>

                            {/* Additional Stats */}
                            <div className="mt-8">
                                <h3 className='rounded-t-lg bg-neutral-900 p-3 text-lg font-semibold text-purple-400'>Additional Statistics</h3>
                                {calculatedStats.totalTransactions > 0 ? (
                                <ul className="list-none p-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                                    {[
                                        { label: "Peak Hour", value: calculatedStats.peakHour }, { label: "Busiest Day (Value)", value: calculatedStats.bestDay },
                                        { label: "Most Used Payment", value: calculatedStats.topPaymentMethod }, { label: "Refund Rate", value: `${calculatedStats.refundRate}%` },
                                        { label: "Avg Items/Sale", value: calculatedStats.avgItemsPerSale }, { label: "Revenue/Active Hour", value: `R${calculatedStats.revenuePerHour.toFixed(2)}` },
                                    ].map(stat => (<li key={stat.label} className="bg-neutral-700 p-3 rounded-md text-sm">
                                        <span className="font-semibold text-neutral-300">{stat.label}:</span> <span className="text-purple-300">{stat.value}</span>
                                    </li>))}</ul>
                                ) : (<p className="text-neutral-400 p-3">No additional statistics for this period/store.</p>)}
                            </div>
                        </div>
                    )}
                    {!loading && !error && filteredData.sales.length === 0 && filteredData.refunds.length === 0 && (
                         <div className="mt-6 p-4 bg-yellow-600/20 border border-yellow-500 rounded text-white text-center">
                            No sales or refund data available for the selected criteria after filtering.
                        </div>
                    )}
                </div>
            </div>
        </RouteGuard>
    );
}