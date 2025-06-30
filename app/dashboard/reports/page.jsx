'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore'; 
import db from '../../../utils/firebase'; 
import { auth } from '../../../utils/firebase'; 
import { useAuthState } from 'react-firebase-hooks/auth';
import RouteGuard from '../../components/RouteGuard';
import {
    calculateProductPaymentTotals,
    calculateRefundTotals,
    calculateStaffTotals,
    calculateVoucherStats,
    calculateAdditionalStats
} from '../../../utils/reportCalculations';

import { pdf, Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer'

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



export default function Reports() {
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
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
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

    const [voucherStats, setVoucherStats] = useState({
        totalVouchersRedeemed: 0,
        totalVoucherValue: 0,
        voucherUsageByType: {},
        mostPopularVoucherType: 'N/A',
        percentSalesWithVouchers: 0,
    });

    const [selectedStore, setSelectedStore] = useState('All stores');
    const [loading, setLoading] = useState(false); // Combined loading state
    const [error, setError] = useState('');
    const [liveUpdate, setLiveUpdate] = useState(false);
    const prevMasterDataRef = useRef(masterData);

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

    // NEW: Automatically set the store for staff members
    useEffect(() => {
        if (staffAuth?.accountType === 'staff' && user?.email) {
            setSelectedStore(user.email);
        }
    }, [staffAuth, user]);


    // Replace fetchAllMasterData with a real-time listener
    useEffect(() => {
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

        const unsubscribes = [];
        const collectionsToFetch = [
            { name: 'sales', stateKey: 'sales' },
            { name: 'products', stateKey: 'products' },
            { name: 'specials', stateKey: 'specials' },
            { name: 'staff', stateKey: 'staff' },
            { name: 'vouchers', stateKey: 'vouchers' },
            { name: 'refunds', stateKey: 'refunds' },
        ];

        collectionsToFetch.forEach(({ name, stateKey }) => {
            const unsubscribe = onSnapshot(
                collection(db, name),
                (snapshot) => {
                    setMasterData(current => ({
                        ...current,
                        [stateKey]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                    }));
                    setLoading(false);
                },
                (err) => {
                    setError(`Failed to fetch ${name}: ${err.message}`);
                    setLoading(false);
                }
            );
            unsubscribes.push(unsubscribe);
        });

        // Cleanup on unmount
        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [user, loadingAuth, errorAuth]);

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
            
            const storeMatch = selectedStore === 'All stores' || sale.storeId === selectedStore;
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



    // Effect for processing data when filteredData changes
    useEffect(() => {
        // setLoading(true) should have been set by the filtering useEffect
        if (filteredData.sales && filteredData.refunds) {
            setSalesTotals(calculateProductPaymentTotals(filteredData.sales));
            setRefundTotals(calculateRefundTotals(filteredData.refunds));
            setStaffTotals(calculateStaffTotals(filteredData.sales));
            setCalculatedStats(calculateAdditionalStats(filteredData.sales, filteredData.refunds));
            setVoucherStats(calculateVoucherStats(filteredData.sales, masterData.vouchers, dateRange, selectedStore));
        } else {
            setSalesTotals({}); setRefundTotals([]); setStaffTotals([]);
            setCalculatedStats({ /* initial empty stats */ });
            setVoucherStats({ /* initial empty voucher stats */ });
        }
        setLoading(false); // All data fetching, filtering, and calculations are done
    }, [filteredData, calculateProductPaymentTotals, calculateRefundTotals, calculateStaffTotals, calculateAdditionalStats, calculateVoucherStats, masterData.vouchers]);


    const handleStoreChange = (e) => setSelectedStore(e.target.value);
    const handleDateChange = (e, type) => setDateRange(prev => ({ ...prev, [type]: e.target.value }));
    
    // Enhanced PDF Styles
    const styles = StyleSheet.create({
        // Page and Document Styles
        page: { 
            padding: 40, 
            fontFamily: 'Helvetica',
            backgroundColor: '#FFFFFF' 
        },
        headerContainer: {
            flexDirection: 'row',
            marginBottom: 20,
            paddingBottom: 15,
            borderBottom: '2 solid #6B46C1'
        },
        headerLogo: {
            width: 60,
            height: 60,
            marginRight: 15
        },
        headerTextContainer: {
            flex: 1,
            justifyContent: 'center'
        },
        reportDateRange: {
            fontSize: 11,
            color: '#4B5563',
            marginTop: 4
        },
        
        // Titles and Headings
        title: {
            fontSize: 22,
            marginBottom: 6,
            fontWeight: 'bold',
            color: '#6B46C1' // Purple to match iBEAN brand
        },
        subtitle: {
            fontSize: 12,
            color: '#4B5563',
            marginBottom: 15
        },
        sectionHeader: {
            backgroundColor: '#F3F4F6',
            paddingVertical: 8,
            paddingHorizontal: 10,
            marginTop: 25,
            marginBottom: 10,
            borderRadius: 4,
            borderLeft: '4 solid #6B46C1',
            fontSize: 14,
            fontWeight: 'bold',
            color: '#1F2937'
        },
        
        // General text
        description: {
            fontSize: 10,
            color: '#4B5563',
            marginBottom: 8,
            lineHeight: 1.4
        },
        
        // Table styles
        table: {
            display: 'table',
            width: 'auto',
            marginBottom: 15,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderStyle: 'solid'
        },
        tableRow: {
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
            borderBottomStyle: 'solid',
            alignItems: 'center',
            minHeight: 24
        },
        tableRowAlternate: {
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
            borderBottomStyle: 'solid',
            alignItems: 'center',
            minHeight: 24,
            backgroundColor: '#F9FAFB'
        },
        tableCellHeader: {
            flex: 1,
            backgroundColor: '#6B46C1',
            fontSize: 10,
            fontWeight: 'bold',
            padding: 8,
            color: '#FFFFFF',
            borderRightWidth: 1,
            borderRightColor: '#9F7AEA',
            borderRightStyle: 'solid'
        },
        tableCell: {
            flex: 1,
            fontSize: 9,
            padding: 6,
            color: '#4B5563',
            borderRightWidth: 1,
            borderRightColor: '#E5E7EB',
            borderRightStyle: 'solid'
        },
        highlightCell: {
            flex: 1,
            fontSize: 9,
            padding: 6,
            color: '#6B46C1',
            fontWeight: 'bold',
            borderRightWidth: 1,
            borderRightColor: '#E5E7EB',
            borderRightStyle: 'solid'
        },
        
        // List and stat blocks
        statsContainer: {
            marginTop: 10,
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between'
        },
        statItem: {
            width: '48%',
            marginBottom: 10,
            backgroundColor: '#F9FAFB',
            borderRadius: 4,
            padding: 8,
            borderLeftWidth: 3,
            borderLeftColor: '#6B46C1',
            borderLeftStyle: 'solid'
        },
        statLabel: {
            fontSize: 9,
            fontWeight: 'bold',
            color: '#4B5563',
            marginBottom: 2
        },
        statValue: {
            fontSize: 11,
            color: '#111827',
            fontWeight: 'bold'
        },
        
        // Footer
        footer: {
            position: 'absolute',
            bottom: 30,
            left: 40,
            right: 40,
            textAlign: 'center',
            fontSize: 8,
            color: '#9CA3AF',
            borderTop: '1 solid #E5E7EB',
            paddingTop: 10
        }
    });
      
    // Function definition
    const handleExportToPdf = async () => {
        const doc = (
            <Document>
                <Page size="A4" style={styles.page}>
                    {/* Professional Header with Logo */}
                    <View style={styles.headerContainer}>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.title}>iBEAN Sales Analysis</Text>
                            <Text style={styles.subtitle}>{selectedStore}</Text>
                            <Text style={styles.reportDateRange}>Report Period: {dateRange.start} to {dateRange.end}</Text>
                        </View>
                    </View>

                    {/* Sales Report Table */}
                    <Text style={styles.sectionHeader}>Sales Report</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCellHeader}>Item</Text>
                            <Text style={styles.tableCellHeader}>Cash</Text>
                            <Text style={styles.tableCellHeader}>Card</Text>
                            <Text style={styles.tableCellHeader}>SnapScan</Text>
                            <Text style={styles.tableCellHeader}>Other</Text>
                            <Text style={styles.tableCellHeader}>Total</Text>
                        </View>
                        {Object.values(salesTotals).sort((a, b) => b.Total - a.Total).map((sale, index) => (
                            <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}>
                                <Text style={styles.tableCell}>{sale.Product}</Text>
                                <Text style={styles.tableCell}>R {sale.Cash.toFixed(2)}</Text>
                                <Text style={styles.tableCell}>R {sale.Card.toFixed(2)}</Text>
                                <Text style={styles.tableCell}>R {sale.Snapscan.toFixed(2)}</Text>
                                <Text style={styles.tableCell}>R {sale.Other.toFixed(2)}</Text>
                                <Text style={styles.highlightCell}>R {sale.Total.toFixed(2)}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Refunds Table */}
                    <Text style={styles.sectionHeader}>Refunds Issued</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCellHeader}>Crew Member</Text>
                            <Text style={styles.tableCellHeader}>Item</Text>
                            <Text style={styles.tableCellHeader}>Method</Text>
                            <Text style={styles.tableCellHeader}>Reason</Text>
                            <Text style={styles.tableCellHeader}>Amount</Text>
                        </View>
                        {refundTotals.map((refund, index) => (
                            <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}>
                                <Text style={styles.tableCell}>{refund.staffName}</Text>
                                <Text style={styles.tableCell}>{refund.item}</Text>
                                <Text style={styles.tableCell}>{refund.method}</Text>
                                <Text style={styles.tableCell}>{refund.reason}</Text>
                                <Text style={styles.highlightCell}>R {refund.amount.toFixed(2)}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Crew Table */}
                    <Text style={styles.sectionHeader}>Crew Performance</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCellHeader}>Crew Member</Text>
                            <Text style={styles.tableCellHeader}>Transactions</Text>
                            <Text style={styles.tableCellHeader}>Avg Sale</Text>
                            <Text style={styles.tableCellHeader}>Total Sales</Text>
                            <Text style={styles.tableCellHeader}>Most Sold Product</Text>
                        </View>
                        {staffTotals.sort((a, b) => b.total - a.total).map((staff, index) => (
                            <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}>
                                <Text style={styles.tableCell}>{staff.staffName}</Text>
                                <Text style={styles.tableCell}>{staff.transactions}</Text>
                                <Text style={styles.tableCell}>R {staff.averageSale.toFixed(2)}</Text>
                                <Text style={styles.highlightCell}>R {staff.total.toFixed(2)}</Text>
                                <Text style={styles.tableCell}>{staff.mostPopularProduct}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Voucher Table */}
                    <Text style={styles.sectionHeader}>Voucher Statistics</Text>
                    <Text style={styles.description}>Summary of voucher usage including discount percentages, fixed amount discounts, and free items</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCellHeader}>Voucher Type</Text>
                            <Text style={styles.tableCellHeader}>Count</Text>
                            <Text style={styles.tableCellHeader}>Value</Text>
                        </View>
                        {Object.keys(voucherStats.voucherUsageByType).map((voucherType, index) => (
                            <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}>
                                <Text style={styles.tableCell}>{voucherType}</Text>
                                <Text style={styles.tableCell}>{voucherStats.voucherUsageByType[voucherType].count}</Text>
                                <Text style={styles.highlightCell}>R {voucherStats.voucherUsageByType[voucherType].value.toFixed(2)}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Stats List in Grid Layout */}
                    <Text style={styles.sectionHeader}>Summary Statistics</Text>
                    <View style={styles.statsContainer}>
                        {[
                            { label: "Peak Hour", value: calculatedStats.peakHour },
                            { label: "Busiest Day (Value)", value: calculatedStats.bestDay },
                            { label: "Most Used Payment", value: calculatedStats.topPaymentMethod },
                            { label: "Refund Rate", value: `${calculatedStats.refundRate}%` },
                            { label: "Avg Items/Sale", value: calculatedStats.avgItemsPerSale },
                            { label: "Revenue/Active Hour", value: `R${calculatedStats.revenuePerHour.toFixed(2)}` },
                            { label: "Total Vouchers Redeemed", value: voucherStats.totalVouchersRedeemed },
                            { label: "Total Voucher Value", value: `R${voucherStats.totalVoucherValue.toFixed(2)}` },
                            { label: "Most Popular Voucher Type", value: voucherStats.mostPopularVoucherType },
                            { label: "Percent Sales with Vouchers", value: `${voucherStats.percentSalesWithVouchers}%` },
                        ].map((stat, index) => (
                            <View key={index} style={styles.statItem}>
                                <Text style={styles.statLabel}>{stat.label}</Text>
                                <Text style={styles.statValue}>{stat.value}</Text>
                            </View>
                        ))}
                    </View>
                    
                    {/* Footer */}
                    <Text style={styles.footer}>Generated by iBEAN Management System • {new Date().toLocaleDateString()} • Confidential</Text>
                </Page>
            </Document>
        );

        const blob = await pdf(doc).toBlob();
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'report.pdf';
        link.click();

        URL.revokeObjectURL(url); // Cleanup

    };

    
    useEffect(() => {
        // Only animate if this isn't the first load
        if (prevMasterDataRef.current && prevMasterDataRef.current !== masterData) {
            setLiveUpdate(true);
            const timeout = setTimeout(() => setLiveUpdate(false), 600); // Animation duration
            return () => clearTimeout(timeout);
        }
        prevMasterDataRef.current = masterData;
    }, [masterData]);

    return (
        <RouteGuard requiredRoles={['manager', 'staff']} currentRole={staffAuth?.accountType}>
            <div className="min-h-screen bg-neutral-900 p-4 md:p-8">
                <div className="">

                    <div className="bg-neutral-800 p-6 rounded-lg shadow-lg mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            {staffAuth?.accountType === 'manager' ? (
                                <div>
                                    <label htmlFor="storeSelect" className="block text-sm font-medium text-neutral-300 mb-1">Select Store</label>
                                    <select
                                        id="storeSelect"
                                        value={selectedStore}
                                        onChange={handleStoreChange}
                                        className="w-full p-2 bg-neutral-700 rounded text-white focus:ring-green-500 focus:border-green-500"
                                    >
                                        <option value="All stores">All stores</option>
                                        {stores.map(store => (
                                            <option key={store.id} value={store.id}>{store.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : staffAuth?.accountType === 'staff' ? (
                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-1">Store</label>
                                    <div className="w-full p-2 bg-neutral-700 rounded text-white">
                                        {stores.find(store => store.id === user?.email)?.name || user?.email || 'Loading...'}
                                    </div>
                                </div>
                            ) : null}
                            <div>
                                <label htmlFor="startDate" className="block text-sm font-medium text-neutral-300 mb-1">Start Date</label>
                                <input id="startDate" type="date" value={dateRange.start} onChange={(e) => handleDateChange(e, 'start')} className="w-full p-2 bg-neutral-700 rounded text-white focus:ring-green-500 focus:border-green-500" />
                            </div>
                            <div>
                                <label htmlFor="endDate" className="block text-sm font-medium text-neutral-300 mb-1">End Date</label>
                                <input id="endDate" type="date" value={dateRange.end} onChange={(e) => handleDateChange(e, 'end')} className="w-full p-2 bg-neutral-700 rounded text-white focus:ring-green-500 focus:border-green-500" />
                            </div>
                            <div className="">
                                    <button
                                        onClick={handleExportToPdf}
                                        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                                        disabled={loading} // Disable if data is still loading
                                    >
                                        {loading ? 'Generating...' : 'Export to PDF'}
                                    </button>
                            </div>
                        </div>
                        {error && (<div className="mt-4 p-3 bg-red-600/30 border border-red-500 rounded text-white text-sm">{error}</div>)}
                        {loading && (<div className="mt-4 p-3 bg-blue-600/30 border border-blue-500 rounded text-white text-sm">Loading and processing data... Please wait.</div>)}
                    </div>
                    
                    {!loading && !error && (
                        <div
                            id="report-content"
                            className={`p-2 sm:p-4 md:p-6 bg-neutral-800 rounded-lg shadow-lg transition-all duration-500 ${
                                liveUpdate ? 'ring-4 ring-green-500/40 animate-pulse' : ''
                            }`}
                        >
                            <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
                                Analysis Report:
                                <span className="rounded-lg bg-neutral-900 px-2 py-1 text-green-500 text-base sm:text-lg">{stores.find(s => s.id === selectedStore)?.name || selectedStore}</span>
                                <span className="text-xs sm:text-sm text-neutral-400 block sm:inline sm:ml-2">
                                    ({new Date(dateRange.start + 'T00:00:00').toLocaleDateString()} - {new Date(dateRange.end + 'T00:00:00').toLocaleDateString()})
                                </span>
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 text-neutral-300">
                                <div className="bg-neutral-700 p-3 sm:p-4 rounded-lg"><strong>Total Transactions:</strong> {calculatedStats.totalTransactions}</div>
                                <div className="bg-neutral-700 p-3 sm:p-4 rounded-lg"><strong>Total Sales Value:</strong> R{calculatedStats.totalSalesValue.toFixed(2)}</div>
                                <div className="bg-neutral-700 p-3 sm:p-4 rounded-lg"><strong>Total Refunds Value:</strong> R{calculatedStats.totalRefundsValue.toFixed(2)}</div>
                            </div>

                            {/* Table 1: Product Sales */}
                            <div className="mt-6">
                                <h3 className="rounded-t-lg bg-neutral-900 p-3 text-base sm:text-lg font-semibold text-green-500">Product Sales Summary</h3>
                                {Object.keys(salesTotals).length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full bg-neutral-800 border border-neutral-700 text-green-500 text-xs sm:text-sm">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-neutral-700">
                                                    <th className="px-2 sm:px-4 py-2 text-left">Product</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Cash</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Card</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">SnapScan</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Other</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.values(salesTotals).sort((a,b) => b.Total - a.Total).map((sale, index) => (
                                                    <tr key={index} className="border-b border-neutral-700 hover:bg-neutral-700/50">
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">{sale.Product}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">R{sale.Cash.toFixed(2)}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">R{sale.Card.toFixed(2)}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">R{sale.Snapscan.toFixed(2)}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">R{sale.Other.toFixed(2)}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300 font-semibold">R{sale.Total.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (<p className="text-neutral-400 p-3">No product sales data for this period/store.</p>)}
                            </div>

                            {/* Table 2: Refunds */}
                            <div className="mt-8">
                                <h3 className="rounded-t-lg bg-neutral-900 p-3 text-base sm:text-lg font-semibold text-red-500">Refunds Issued</h3>
                                {refundTotals.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full bg-neutral-800 border border-neutral-700 text-red-500 text-xs sm:text-sm">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-neutral-700">
                                                    <th className="px-2 sm:px-4 py-2 text-left">Staff</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Item</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Method</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Reason</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {refundTotals.map((refund, index) => (
                                                    <tr key={index} className="border-b border-neutral-700 hover:bg-neutral-700/50">
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">{refund.staffName}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">{refund.item}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">{refund.method}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">{refund.reason}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">R{refund.amount.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (<p className="text-neutral-400 p-3">No refunds issued for this period/store.</p>)}
                            </div>

                            {/* Table 3: Crew Performance */}
                            <div className="mt-8">
                                <h3 className="rounded-t-lg bg-neutral-900 p-3 text-base sm:text-lg font-semibold text-blue-400">Crew Performance</h3>
                                {staffTotals.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full bg-neutral-800 border border-neutral-700 text-blue-400 text-xs sm:text-sm">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-neutral-700">
                                                    <th className="px-2 sm:px-4 py-2 text-left">Staff</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Transactions</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Avg Sale</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Total Sales</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Most Sold</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {staffTotals.sort((a,b) => b.total - a.total).map((staff, index) => (
                                                    <tr key={index} className="border-b border-neutral-700 hover:bg-neutral-700/50">
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">{staff.staffName}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">{staff.transactions}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">R{staff.averageSale.toFixed(2)}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">R{staff.total.toFixed(2)}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">{staff.mostPopularProduct}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (<p className="text-neutral-400 p-3">No staff performance data for this period/store.</p>)}
                            </div>

                            {/* Voucher Table */}
                            <div className="mt-8">
                                <h3 className="rounded-t-lg bg-neutral-900 p-3 text-base sm:text-lg font-semibold text-yellow-400">Voucher Statistics</h3>
                                {Object.keys(voucherStats.voucherUsageByType).length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full bg-neutral-800 border border-neutral-700 text-yellow-400 text-xs sm:text-sm">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-neutral-700">
                                                    <th className="px-2 sm:px-4 py-2 text-left">Voucher Type</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Count</th>
                                                    <th className="px-2 sm:px-4 py-2 text-left">Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.keys(voucherStats.voucherUsageByType).map((voucherType, index) => (
                                                    <tr key={index} className="border-b border-neutral-700 hover:bg-neutral-700/50">
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">{voucherType}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">{voucherStats.voucherUsageByType[voucherType].count}</td>
                                                        <td className="px-2 sm:px-4 py-2 text-neutral-300">R {voucherStats.voucherUsageByType[voucherType].value.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (<p className="text-neutral-400 p-3">No voucher usage data for this period/store.</p>)}
                            </div>

                            {/* Additional Stats */}
                            <div className="mt-8">
                                <h3 className="rounded-t-lg bg-neutral-900 p-3 text-base sm:text-lg font-semibold text-purple-400">Additional Statistics</h3>
                                {calculatedStats.totalTransactions > 0 ? (
                                    <ul className="list-none p-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-2">
                                        {[
                                            { label: "Peak Hour", value: calculatedStats.peakHour }, { label: "Busiest Day (Value)", value: calculatedStats.bestDay },
                                            { label: "Most Used Payment", value: calculatedStats.topPaymentMethod }, { label: "Refund Rate", value: `${calculatedStats.refundRate}%` },
                                            { label: "Avg Items/Sale", value: calculatedStats.avgItemsPerSale }, { label: "Revenue/Active Hour", value: `R${calculatedStats.revenuePerHour.toFixed(2)}` },
                                            { label: "Total Vouchers Redeemed", value: voucherStats.totalVouchersRedeemed },
                                            { label: "Total Voucher Value", value: `R${voucherStats.totalVoucherValue.toFixed(2)}` },
                                            { label: "Most Popular Voucher Type", value: voucherStats.mostPopularVoucherType },
                                            { label: "Percent Sales with Vouchers", value: `${voucherStats.percentSalesWithVouchers}%` },
                                        ].map(stat => (
                                            <li key={stat.label} className="bg-neutral-700 p-3 rounded-md text-xs sm:text-sm">
                                                <span className="font-semibold text-neutral-300">{stat.label}:</span> <span className="text-purple-300">{stat.value}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (<p className="text-neutral-400 p-3">No additional statistics for this period/store.</p>)}
                            </div>
                        </div>
                    )}
                    {!loading && !error && masterData.sales.length === 0 && masterData.refunds.length === 0 && (
                         <div className="mt-6 p-4 bg-yellow-600/20 border border-yellow-500 rounded text-white text-center">
                            No sales or refund data available for the selected criteria after filtering.
                        </div>
                    )}
                </div>
            </div>
        </RouteGuard>
    );
}