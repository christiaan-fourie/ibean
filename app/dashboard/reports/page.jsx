'use client';

import { Fragment, useState, useMemo } from 'react';
import RouteGuard from '../../components/RouteGuard';
import { useDashboardSession } from '../../components/DashboardSessionContext';
import { useCollectionLive } from '../../hooks/useCollectionLive';
import {
    calculateProductPaymentTotals,
    calculateRefundTotals,
    calculateStaffTotals,
    calculateVoucherStats,
    calculateAdditionalStats
} from '../../../utils/reportCalculations';
import {
    aggregateSalesReconciliation,
    aggregateSpecialsBreakdown,
    sumAggregateProductTotals,
} from '../../../utils/pricing';
import { CHILLZONE_STORES } from '../../../utils/stores';

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
    const { user, staffAuth, isSessionReady } = useDashboardSession();
    const salesLive = useCollectionLive('sales');
    const productsLive = useCollectionLive('products');
    const specialsLive = useCollectionLive('specials');
    const staffLive = useCollectionLive('staff');
    const vouchersLive = useCollectionLive('vouchers');
    const refundsLive = useCollectionLive('refunds');

    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
    });
    const stores = CHILLZONE_STORES;

    const [selectedStore, setSelectedStore] = useState('All stores');
    const [expandedTransactions, setExpandedTransactions] = useState([]);
    const effectiveSelectedStore = staffAuth?.accountType === 'staff' ? (user?.email || 'All stores') : selectedStore;
    const masterData = useMemo(() => ({
        sales: salesLive.data,
        products: productsLive.data,
        specials: specialsLive.data,
        staff: staffLive.data,
        vouchers: vouchersLive.data,
        refunds: refundsLive.data,
    }), [
        salesLive.data,
        productsLive.data,
        specialsLive.data,
        staffLive.data,
        vouchersLive.data,
        refundsLive.data,
    ]);

    const loading = !isSessionReady || salesLive.isLoading || productsLive.isLoading || specialsLive.isLoading || staffLive.isLoading || vouchersLive.isLoading || refundsLive.isLoading;
    const error = !user
        ? 'Please log in to view reports.'
        : [
            salesLive.error,
            productsLive.error,
            specialsLive.error,
            staffLive.error,
            vouchersLive.error,
            refundsLive.error,
        ].find(Boolean)?.message || '';

    const filteredData = useMemo(() => {
        const startDate = getStartOfDayFromString(dateRange.start);
        const endDate = getEndOfDayFromString(dateRange.end);

        const matchesStore = (storeId) => (
            effectiveSelectedStore === 'All stores' || storeId === effectiveSelectedStore
        );

        const resolveDate = (item) => {
            if (item?.date && typeof item.date.toDate === 'function') return item.date.toDate();
            if (typeof item?.date === 'string') return getStartOfDayFromString(item.date);
            if (item?.timestamp && typeof item.timestamp.toDate === 'function') return item.timestamp.toDate();
            if (typeof item?.timestamp === 'string') return getStartOfDayFromString(item.timestamp);
            return null;
        };

        const sales = masterData.sales.filter((sale) => {
            const saleDate = resolveDate(sale);
            if (!saleDate) return false;
            return matchesStore(sale.storeId) && saleDate >= startDate && saleDate <= endDate;
        });

        const refunds = masterData.refunds.filter((refund) => {
            const refundDate = resolveDate(refund);
            if (!refundDate) return false;
            return matchesStore(refund.storeId) && refundDate >= startDate && refundDate <= endDate;
        });

        return { sales, refunds };
    }, [masterData.sales, masterData.refunds, dateRange.start, dateRange.end, effectiveSelectedStore]);

    const salesTotals = useMemo(
        () => calculateProductPaymentTotals(filteredData.sales),
        [filteredData.sales]
    );
    const salesReconciliation = useMemo(
        () => aggregateSalesReconciliation(filteredData.sales),
        [filteredData.sales]
    );
    const specialsBreakdown = useMemo(
        () => aggregateSpecialsBreakdown(filteredData.sales),
        [filteredData.sales]
    );
    const refundTotals = useMemo(
        () => calculateRefundTotals(filteredData.refunds),
        [filteredData.refunds]
    );
    const staffTotals = useMemo(
        () => calculateStaffTotals(filteredData.sales),
        [filteredData.sales]
    );
    const calculatedStats = useMemo(
        () => calculateAdditionalStats(filteredData.sales, filteredData.refunds),
        [filteredData.sales, filteredData.refunds]
    );
    const voucherStats = useMemo(
        () => calculateVoucherStats(filteredData.sales, masterData.vouchers, dateRange, effectiveSelectedStore),
        [filteredData.sales, masterData.vouchers, dateRange, effectiveSelectedStore]
    );
    const scopeStoreLabel = stores.find((s) => s.id === effectiveSelectedStore)?.name || effectiveSelectedStore;
    const formatTransactionItem = (item) => {
        const quantity = Number(item?.quantity) || 1;
        const baseName = item?.name || item?.productName || 'Item';
        const variant = item?.size || item?.variety || item?.selectedVariety || '';
        const label = variant ? `${baseName} (${variant})` : baseName;
        const lineTotal = Number(item?.subtotal ?? (Number(item?.price) || 0) * quantity);

        return {
            quantity,
            label,
            lineTotal,
        };
    };

    const getTransactionItems = (sale) => (Array.isArray(sale?.items) ? sale.items.map(formatTransactionItem) : []);
    const getTransactionKey = (sale, index) => sale.id || sale.orderNumber || `${sale.storeId || 'store'}-${sale.resolvedDate?.getTime?.() || index}`;
    const toggleTransactionItems = (sale, index) => {
        const key = getTransactionKey(sale, index);
        setExpandedTransactions((current) => (
            current.includes(key)
                ? current.filter((entry) => entry !== key)
                : [...current, key]
        ));
    };
    const isTransactionExpanded = (sale, index) => expandedTransactions.includes(getTransactionKey(sale, index));

    const transactionHistory = useMemo(() => {
        const resolveDate = (item) => {
            if (item?.date && typeof item.date.toDate === 'function') return item.date.toDate();
            if (typeof item?.date === 'string') return getStartOfDayFromString(item.date);
            if (item?.timestamp && typeof item.timestamp.toDate === 'function') return item.timestamp.toDate();
            if (typeof item?.timestamp === 'string') return getStartOfDayFromString(item.timestamp);
            return null;
        };

        return [...filteredData.sales]
            .map((sale) => ({
                ...sale,
                resolvedDate: resolveDate(sale),
                itemCount: Array.isArray(sale.items)
                    ? sale.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
                    : 0,
            }))
            .sort((a, b) => (b.resolvedDate?.getTime?.() || 0) - (a.resolvedDate?.getTime?.() || 0));
    }, [filteredData.sales]);

    const handleStoreChange = (e) => setSelectedStore(e.target.value);
    const handleDateChange = (e, type) => setDateRange(prev => ({ ...prev, [type]: e.target.value }));
    const applyPreset = (preset) => {
        const today = new Date();
        const end = new Date(today);
        const start = new Date(today);

        if (preset === 'today') {
            // start/end already point to today
        } else if (preset === '7d') {
            start.setDate(today.getDate() - 6);
        } else if (preset === 'mtd') {
            start.setDate(1);
        }

        setDateRange({
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
        });
    };
    
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

                    <Text style={styles.sectionHeader}>Sales Reconciliation</Text>
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Gross (subtotalBeforeDiscounts)</Text>
                            <Text style={styles.statValue}>R {salesReconciliation.gross.toFixed(2)}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Promotions (specials + vouchers)</Text>
                            <Text style={styles.statValue}>-R {salesReconciliation.promotions.toFixed(2)}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Net (sale.total)</Text>
                            <Text style={styles.statValue}>R {salesReconciliation.net.toFixed(2)}</Text>
                        </View>
                    </View>

                    {specialsBreakdown.length > 0 && (
                        <>
                            <Text style={styles.sectionHeader}>Specials Applied</Text>
                            <View style={styles.table}>
                                <View style={styles.tableRow}>
                                    <Text style={styles.tableCellHeader}>Special</Text>
                                    <Text style={styles.tableCellHeader}>Times</Text>
                                    <Text style={styles.tableCellHeader}>Total saved</Text>
                                </View>
                                {specialsBreakdown.map((row, index) => (
                                    <View key={row.id} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}>
                                        <Text style={styles.tableCell}>{row.name}</Text>
                                        <Text style={styles.tableCell}>{row.timesApplied}</Text>
                                        <Text style={styles.highlightCell}>R {row.totalSaved.toFixed(2)}</Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    <Text style={styles.sectionHeader}>Transaction History</Text>
                    <Text style={styles.description}>
                        {transactionHistory.length} transactions in the selected scope.
                    </Text>
                    <View style={styles.table}>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCellHeader}>Date / Time</Text>
                            <Text style={styles.tableCellHeader}>Staff</Text>
                            <Text style={styles.tableCellHeader}>Method</Text>
                            <Text style={styles.tableCellHeader}>Items</Text>
                            <Text style={styles.tableCellHeader}>Total</Text>
                        </View>
                        {transactionHistory.map((sale, index) => (
                            <Fragment key={sale.id || index}>
                                <View style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}>
                                    <Text style={styles.tableCell}>
                                        {sale.resolvedDate ? sale.resolvedDate.toLocaleString('en-ZA') : '--'}
                                    </Text>
                                    <Text style={styles.tableCell}>{sale.staffName || sale.createdBy?.name || 'Unknown'}</Text>
                                    <Text style={styles.tableCell}>{sale.payment?.method || 'unknown'}</Text>
                                    <Text style={styles.tableCell}>{sale.itemCount}</Text>
                                    <Text style={styles.highlightCell}>R {Number(sale.total || 0).toFixed(2)}</Text>
                                </View>
                                <View style={styles.tableRowAlternate}>
                                    <Text style={[styles.tableCell, { flex: 1, borderRightWidth: 0, color: '#374151' }]}>
                                        {(() => {
                                            const items = getTransactionItems(sale);
                                            return items.length > 0 ? (
                                                <>
                                                    <Text style={{ fontWeight: 'bold', color: '#111827' }}>Items: </Text>
                                                    {items
                                                        .map((item) => `${item.quantity}x ${item.label} - R ${item.lineTotal.toFixed(2)}`)
                                                        .join('  ·  ')}
                                                </>
                                            ) : (
                                                'Items: No items recorded'
                                            );
                                        })()}
                                    </Text>
                                </View>
                            </Fragment>
                        ))}
                    </View>

                    <Text style={styles.sectionHeader}>Product Sales (gross line subtotals)</Text>
                    <Text style={styles.description}>
                        Menu-value totals from items sold (ZAR, before promotions). Product table: R {sumAggregateProductTotals(salesTotals).toFixed(2)} · Gross reconciliation: R {salesReconciliation.gross.toFixed(2)} · Net after promotions: R {salesReconciliation.net.toFixed(2)}.
                    </Text>
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

    return (
        <RouteGuard requiredRoles={['manager', 'staff']}>
            <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-neutral-900/35 p-3 text-neutral-50 md:p-4">
                <div className="mb-3 rounded-3xl border border-white/10 bg-neutral-900/60 p-4 shadow-xl backdrop-blur-2xl md:p-6">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <section className="rounded-3xl border border-white/10 bg-white/5 p-3 shadow-lg shadow-black/10">
                            <div className="mb-3">
                                <h2 className="text-base font-semibold text-white">Filters</h2>
                                <p className="text-xs text-neutral-400">Choose the store and time window for this report.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                {staffAuth?.accountType === 'manager' ? (
                                    <div>
                                        <label htmlFor="storeSelect" className="mb-1 block text-sm font-medium text-neutral-300">Store</label>
                                        <select
                                            id="storeSelect"
                                            value={selectedStore}
                                            onChange={handleStoreChange}
                                            className="w-full rounded-2xl border border-white/10 bg-neutral-900/80 p-2.5 text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                                        >
                                            <option value="All stores">All stores</option>
                                            {stores.map(store => (
                                                <option key={store.id} value={store.id}>{store.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : staffAuth?.accountType === 'staff' ? (
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-neutral-300">Store</label>
                                        <div className="w-full rounded-2xl border border-white/10 bg-neutral-900/80 p-2.5 text-white">
                                            {stores.find(store => store.id === user?.email)?.name || user?.email || 'Loading...'}
                                        </div>
                                    </div>
                                ) : null}
                                <div>
                                    <label htmlFor="startDate" className="mb-1 block text-sm font-medium text-neutral-300">Start Date</label>
                                    <input id="startDate" type="date" value={dateRange.start} onChange={(e) => handleDateChange(e, 'start')} className="w-full rounded-2xl border border-white/10 bg-neutral-900/80 p-2.5 text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25" />
                                </div>
                                <div>
                                    <label htmlFor="endDate" className="mb-1 block text-sm font-medium text-neutral-300">End Date</label>
                                    <input id="endDate" type="date" value={dateRange.end} onChange={(e) => handleDateChange(e, 'end')} className="w-full rounded-2xl border border-white/10 bg-neutral-900/80 p-2.5 text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25" />
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => applyPreset('today')}
                                    className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/10"
                                >
                                    Today
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('7d')}
                                    className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/10"
                                >
                                    7 days
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('mtd')}
                                    className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/10"
                                >
                                    Month to date
                                </button>
                            </div>
                        </section>

                        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-green-500/15 via-emerald-500/10 to-cyan-500/10 p-3 shadow-lg shadow-black/10">
                            <div className="mb-3">
                                <h2 className="text-base font-semibold text-white">Exports</h2>
                                <p className="text-xs text-neutral-300">Exports the current store and date range as a PDF.</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-3">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-400">Current scope</p>
                                <p className="mt-1 text-sm text-white">{scopeStoreLabel}</p>
                                <p className="text-xs text-neutral-400">
                                    {new Date(dateRange.start + 'T00:00:00').toLocaleDateString()} - {new Date(dateRange.end + 'T00:00:00').toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={handleExportToPdf}
                                className="mt-3 min-h-11 w-full rounded-2xl bg-green-600 px-6 py-2 font-semibold text-white shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 disabled:cursor-not-allowed disabled:bg-neutral-600"
                                disabled={loading}
                            >
                                {loading ? 'Generating...' : 'Export to PDF'}
                            </button>
                        </section>
                    </div>
                        {error && (<div className="mt-4 rounded-2xl border border-red-500/40 bg-red-600/20 p-3 text-sm text-white">{error}</div>)}
                        {loading && (<div className="mt-4 rounded-2xl border border-blue-500/40 bg-blue-600/20 p-3 text-sm text-white">Loading and processing data... Please wait.</div>)}
                    </div>
                    
                <div className="rounded-3xl border border-white/10 bg-neutral-900/60 shadow-xl backdrop-blur-2xl">
                    {!loading && !error && (
                        <div
                            id="report-content"
                            className="p-3 sm:p-4 md:p-6"
                        >
                            <h2 className="mb-4 flex flex-col gap-2 text-lg font-semibold text-white sm:flex-row sm:items-center sm:text-xl">
                                Analysis Report:
                                <span className="rounded-2xl border border-white/10 bg-white/5 px-2.5 py-1 text-base text-green-300 shadow-sm sm:text-lg">{stores.find(s => s.id === effectiveSelectedStore)?.name || effectiveSelectedStore}</span>
                                <span className="block text-xs text-neutral-400 sm:ml-2 sm:inline sm:text-sm">
                                    ({new Date(dateRange.start + 'T00:00:00').toLocaleDateString()} - {new Date(dateRange.end + 'T00:00:00').toLocaleDateString()})
                                </span>
                            </h2>
                            <div className="mb-6 grid grid-cols-1 gap-3 text-neutral-300 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 shadow-sm"><strong className="text-neutral-200">Transactions:</strong> {calculatedStats.totalTransactions}</div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 shadow-sm"><strong className="text-neutral-200">Gross sales:</strong> R{salesReconciliation.gross.toFixed(2)}</div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 text-amber-300 shadow-sm"><strong className="text-neutral-200">Promotions:</strong> -R{salesReconciliation.promotions.toFixed(2)}</div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 text-green-300 shadow-sm"><strong className="text-neutral-200">Net sales:</strong> R{salesReconciliation.net.toFixed(2)}</div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 sm:col-span-2 shadow-sm"><strong className="text-neutral-200">Refunds:</strong> R{calculatedStats.totalRefundsValue.toFixed(2)}</div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 text-xs text-neutral-400 shadow-sm sm:col-span-2">
                                    Net = sum of <code className="text-neutral-300">sale.total</code>. Product table = gross line subtotals; promotions are listed separately above.
                                </div>
                            </div>

                            <div className="mb-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                                <h3 className="bg-white/5 px-3 py-2.5 text-sm font-semibold text-cyan-300 sm:text-base">Transaction History</h3>
                                <p className="px-3 pb-2 text-[11px] text-neutral-400 sm:text-xs">
                                    {transactionHistory.length} transactions in the selected scope.
                                </p>
                                {transactionHistory.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-[11px] text-cyan-100 sm:text-sm">
                                            <thead>
                                                <tr className="bg-neutral-900/70">
                                                    <th className="px-2 py-2 text-left sm:px-4">Time</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Staff</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Method</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Items</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Total</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Store</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {transactionHistory.map((sale, index) => (
                                                    <Fragment key={sale.id || index}>
                                                    <tr className="border-b border-white/10 hover:bg-white/5">
                                                        <td className="px-2 py-1.5 text-neutral-200 sm:px-4 sm:py-2">
                                                            {sale.resolvedDate ? sale.resolvedDate.toLocaleString('en-ZA') : '--'}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">
                                                            <div className="max-w-[11rem] truncate">{sale.staffName || sale.createdBy?.name || 'Unknown'}</div>
                                                        </td>
                                                        <td className="px-2 py-1.5 capitalize text-neutral-300 sm:px-4 sm:py-2">
                                                            {sale.payment?.method || 'unknown'}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleTransactionItems(sale, index)}
                                                                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-neutral-100 transition hover:bg-white/10 sm:text-xs"
                                                                aria-expanded={isTransactionExpanded(sale, index)}
                                                                aria-label={`${isTransactionExpanded(sale, index) ? 'Collapse' : 'Expand'} items for transaction`}
                                                            >
                                                                <span>{sale.itemCount} items</span>
                                                                <span className={`transition-transform ${isTransactionExpanded(sale, index) ? 'rotate-180' : ''}`}>v</span>
                                                            </button>
                                                        </td>
                                                        <td className="px-2 py-1.5 font-semibold text-cyan-200 sm:px-4 sm:py-2">
                                                            R{Number(sale.total || 0).toFixed(2)}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">
                                                            <div className="max-w-[10rem] truncate">{stores.find((s) => s.id === sale.storeId)?.name || sale.storeId || 'Unknown store'}</div>
                                                        </td>
                                                    </tr>
                                                    {isTransactionExpanded(sale, index) && (
                                                        <tr className="border-b border-white/10 bg-white/5">
                                                            <td colSpan={6} className="px-2 py-2 sm:px-4">
                                                                <div className="flex flex-wrap gap-2 text-[11px] text-neutral-300 sm:text-sm">
                                                                    {getTransactionItems(sale).length > 0 ? (
                                                                        getTransactionItems(sale).map((item, itemIndex) => (
                                                                            <span
                                                                                key={`${sale.id || index}-item-${itemIndex}`}
                                                                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/60 px-3 py-1.5"
                                                                            >
                                                                                <span className="font-medium text-neutral-100">
                                                                                    {item.quantity}x {item.label}
                                                                                </span>
                                                                                <span className="text-neutral-400">R{item.lineTotal.toFixed(2)}</span>
                                                                            </span>
                                                                        ))
                                                                    ) : (
                                                                        <span className="rounded-full border border-white/10 bg-neutral-900/60 px-3 py-1.5 text-neutral-400">
                                                                            No items recorded
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    </Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="p-3 text-neutral-400">No transactions found for this period/store.</p>
                                )}
                            </div>

                            {specialsBreakdown.length > 0 && (
                                <div className="mb-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                                    <h3 className="bg-white/5 px-3 py-2.5 text-sm font-semibold text-amber-300 sm:text-base">Specials applied (period)</h3>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-[11px] text-amber-100 sm:text-sm">
                                            <thead>
                                                <tr className="bg-neutral-900/70">
                                                    <th className="px-2 py-2 text-left sm:px-4">Special</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Times</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Total saved</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {specialsBreakdown.map((row) => (
                                                    <tr key={row.id} className="border-b border-white/10">
                                                        <td className="px-2 py-1.5 text-neutral-200 sm:px-4 sm:py-2">{row.name}</td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">{row.timesApplied}</td>
                                                        <td className="px-2 py-1.5 font-semibold text-amber-200 sm:px-4 sm:py-2">R{row.totalSaved.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Table 1: Product Sales */}
                            <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                                <h3 className="bg-white/5 px-3 py-2.5 text-sm font-semibold text-green-300 sm:text-base">Product Sales Summary (gross)</h3>
                                <p className="px-3 pb-2 text-[11px] text-neutral-400 sm:text-xs">
                                    Line subtotals at menu prices (ZAR). Promotions are in the summary above — net sales R{salesReconciliation.net.toFixed(2)}. Product gross total R{sumAggregateProductTotals(salesTotals).toFixed(2)}.
                                </p>
                                {Object.keys(salesTotals).length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-[11px] text-green-100 sm:text-sm">
                                            <thead>
                                                <tr className="bg-neutral-900/70">
                                                    <th className="px-2 py-2 text-left sm:px-4">Product</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Cash</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Card</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">SnapScan</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Other</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.values(salesTotals).sort((a,b) => b.Total - a.Total).map((sale, index) => (
                                                    <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                                                        <td className="px-2 py-1.5 text-neutral-200 sm:px-4 sm:py-2">{sale.Product}</td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">R{sale.Cash.toFixed(2)}</td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">R{sale.Card.toFixed(2)}</td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">R{sale.Snapscan.toFixed(2)}</td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">R{sale.Other.toFixed(2)}</td>
                                                        <td className="px-2 py-1.5 font-semibold text-green-200 sm:px-4 sm:py-2">R{sale.Total.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (<p className="p-3 text-neutral-400">No product sales data for this period/store.</p>)}
                            </div>

                            {/* Table 2: Refunds */}
                            <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                                <h3 className="bg-white/5 px-3 py-2.5 text-sm font-semibold text-red-300 sm:text-base">Refunds Issued</h3>
                                {refundTotals.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-[11px] text-red-100 sm:text-sm">
                                            <thead>
                                                <tr className="bg-neutral-900/70">
                                                    <th className="px-2 py-2 text-left sm:px-4">Staff</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Item</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Method</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Reason</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {refundTotals.map((refund, index) => (
                                                    <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                                                        <td className="px-2 py-1.5 text-neutral-200 sm:px-4 sm:py-2">{refund.staffName}</td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">{refund.item}</td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">{refund.method}</td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">{refund.reason}</td>
                                                        <td className="px-2 py-1.5 text-red-200 sm:px-4 sm:py-2">R{refund.amount.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (<p className="p-3 text-neutral-400">No refunds issued for this period/store.</p>)}
                            </div>

                            {/* Table 3: Crew Performance */}
                            <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                                <h3 className="bg-white/5 px-3 py-2.5 text-sm font-semibold text-blue-300 sm:text-base">Crew Performance</h3>
                                {staffTotals.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-[11px] text-blue-100 sm:text-sm">
                                            <thead>
                                                <tr className="bg-neutral-900/70">
                                                    <th className="px-2 py-2 text-left sm:px-4">Staff</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Transactions</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Avg Sale</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Total Sales</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Most Sold</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {staffTotals.sort((a,b) => b.total - a.total).map((staff, index) => (
                                                    <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                                                        <td className="px-2 py-1.5 text-neutral-200 sm:px-4 sm:py-2">{staff.staffName}</td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">{staff.transactions}</td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">R{staff.averageSale.toFixed(2)}</td>
                                                        <td className="px-2 py-1.5 text-blue-200 sm:px-4 sm:py-2">R{staff.total.toFixed(2)}</td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">{staff.mostPopularProduct}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (<p className="p-3 text-neutral-400">No staff performance data for this period/store.</p>)}
                            </div>

                            {/* Voucher Table */}
                            <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                                <h3 className="bg-white/5 px-3 py-2.5 text-sm font-semibold text-yellow-300 sm:text-base">Voucher Statistics</h3>
                                {Object.keys(voucherStats.voucherUsageByType).length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-[11px] text-yellow-100 sm:text-sm">
                                            <thead>
                                                <tr className="bg-neutral-900/70">
                                                    <th className="px-2 py-2 text-left sm:px-4">Voucher Type</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Count</th>
                                                    <th className="px-2 py-2 text-left sm:px-4">Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.keys(voucherStats.voucherUsageByType).map((voucherType, index) => (
                                                    <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                                                        <td className="px-2 py-1.5 text-neutral-200 sm:px-4 sm:py-2">{voucherType}</td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">{voucherStats.voucherUsageByType[voucherType].count}</td>
                                                        <td className="px-2 py-1.5 text-yellow-200 sm:px-4 sm:py-2">R {voucherStats.voucherUsageByType[voucherType].value.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (<p className="p-3 text-neutral-400">No voucher usage data for this period/store.</p>)}
                            </div>

                            {/* Additional Stats */}
                            <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                                <h3 className="bg-white/5 px-3 py-2.5 text-sm font-semibold text-purple-300 sm:text-base">Additional Statistics</h3>
                                {calculatedStats.totalTransactions > 0 ? (
                                    <ul className="mt-2 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                                        {[
                                            { label: "Peak Hour", value: calculatedStats.peakHour }, { label: "Busiest Day (Value)", value: calculatedStats.bestDay },
                                            { label: "Most Used Payment", value: calculatedStats.topPaymentMethod }, { label: "Refund Rate", value: `${calculatedStats.refundRate}%` },
                                            { label: "Avg Items/Sale", value: calculatedStats.avgItemsPerSale }, { label: "Revenue/Active Hour", value: `R${calculatedStats.revenuePerHour.toFixed(2)}` },
                                            { label: "Total Vouchers Redeemed", value: voucherStats.totalVouchersRedeemed },
                                            { label: "Total Voucher Value", value: `R${voucherStats.totalVoucherValue.toFixed(2)}` },
                                            { label: "Most Popular Voucher Type", value: voucherStats.mostPopularVoucherType },
                                            { label: "Percent Sales with Vouchers", value: `${voucherStats.percentSalesWithVouchers}%` },
                                        ].map(stat => (
                                            <li key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] shadow-sm sm:text-sm">
                                                <span className="font-semibold text-neutral-200">{stat.label}:</span> <span className="text-purple-200">{stat.value}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (<p className="p-3 text-neutral-400">No additional statistics for this period/store.</p>)}
                            </div>
                        </div>
                    )}
                    {!loading && !error && masterData.sales.length === 0 && masterData.refunds.length === 0 && (
                         <div className="m-4 rounded-xl border border-yellow-500 bg-yellow-600/20 p-4 text-center text-white">
                            No sales or refund data available for the selected criteria after filtering.
                        </div>
                    )}
                </div>
            </div>
        </RouteGuard>
    );
}
