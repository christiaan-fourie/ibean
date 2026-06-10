'use client';

import { Fragment, useState, useMemo } from 'react';
import RouteGuard from '../../components/RouteGuard';
import { useDashboardSession } from '../../components/DashboardSessionContext';
import { useCollectionLive } from '../../hooks/useCollectionLive';
import {
    calculateProductNetTotals,
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
import { buildReportsPdfBlob } from './reportPdf';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

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

const sortRows = (rows, tableKey, sortKey, direction, accessors) => {
    const accessor = accessors[tableKey]?.[sortKey];
    if (!accessor) return rows;

    const factor = direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
        const aValue = accessor(a);
        const bValue = accessor(b);

        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return (aValue - bValue) * factor;
        }

        return String(aValue ?? '').localeCompare(String(bValue ?? ''), 'en', {
            numeric: true,
            sensitivity: 'base',
        }) * factor;
    });
};

const TableHeader = ({ children, sortState, sortKey, tableKey, onSort, defaultDirection = 'asc', className = '' }) => {
    const isActive = sortState?.key === sortKey;
    const Icon = !isActive
        ? ArrowUpDown
        : sortState.direction === 'asc'
            ? ArrowUp
            : ArrowDown;

    return (
        <button
            type="button"
            onClick={() => onSort(tableKey, sortKey, defaultDirection)}
            className={`inline-flex items-center gap-1.5 text-left transition hover:text-white ${className}`.trim()}
            aria-label={`Sort by ${children}`}
        >
            <span>{children}</span>
            <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-cyan-300' : 'text-neutral-500'}`} aria-hidden="true" />
        </button>
    );
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
    const [tableSorts, setTableSorts] = useState({
        transactions: { key: 'resolvedDate', direction: 'desc' },
        specials: { key: 'totalSaved', direction: 'desc' },
        products: { key: 'Total', direction: 'desc' },
        refunds: { key: 'amount', direction: 'desc' },
        crew: { key: 'total', direction: 'desc' },
        vouchers: { key: 'count', direction: 'desc' },
    });
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
        () => calculateProductNetTotals(filteredData.sales),
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
    const handleTableSort = (tableKey, sortKey, defaultDirection = 'asc') => {
        setTableSorts((current) => {
            const tableState = current[tableKey] || { key: sortKey, direction: defaultDirection };

            if (tableState.key === sortKey) {
                return {
                    ...current,
                    [tableKey]: {
                        key: sortKey,
                        direction: tableState.direction === 'asc' ? 'desc' : 'asc',
                    },
                };
            }

            return {
                ...current,
                [tableKey]: {
                    key: sortKey,
                    direction: defaultDirection,
                },
            };
        });
    };

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
                paymentMethod: sale.payment?.method || 'unknown',
                storeName: stores.find((store) => store.id === sale.storeId)?.name || sale.storeId || 'Unknown store',
                itemCount: Array.isArray(sale.items)
                    ? sale.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
                    : 0,
                pdfItems: getTransactionItems(sale),
            }))
    }, [filteredData.sales, stores]);

    const productRows = useMemo(() => Object.values(salesTotals), [salesTotals]);

    const specialsRows = useMemo(() => [...specialsBreakdown], [specialsBreakdown]);
    const refundRows = useMemo(() => [...refundTotals], [refundTotals]);
    const crewRows = useMemo(() => [...staffTotals], [staffTotals]);
    const voucherRows = useMemo(
        () => Object.entries(voucherStats.voucherUsageByType).map(([voucherType, row]) => ({
            voucherType,
            count: row.count,
            value: row.value,
        })),
        [voucherStats.voucherUsageByType]
    );

    const sortedTransactionHistory = useMemo(
        () => sortRows(
            transactionHistory,
            'transactions',
            tableSorts.transactions.key,
            tableSorts.transactions.direction,
            {
                transactions: {
                    resolvedDate: (row) => row.resolvedDate?.getTime?.() || 0,
                    staffName: (row) => row.staffName || row.createdBy?.name || 'Unknown',
                    paymentMethod: (row) => row.paymentMethod || 'unknown',
                    itemCount: (row) => row.itemCount || 0,
                    total: (row) => row.total || 0,
                    storeName: (row) => row.storeName || 'Unknown store',
                },
            }
        ),
        [tableSorts.transactions, transactionHistory]
    );

    const sortedSpecialsRows = useMemo(
        () => sortRows(
            specialsRows,
            'specials',
            tableSorts.specials.key,
            tableSorts.specials.direction,
            {
                specials: {
                    name: (row) => row.name || '',
                    timesApplied: (row) => row.timesApplied || 0,
                    totalSaved: (row) => row.totalSaved || 0,
                },
            }
        ),
        [specialsRows, tableSorts.specials]
    );

    const sortedProductRows = useMemo(
        () => sortRows(
            productRows,
            'products',
            tableSorts.products.key,
            tableSorts.products.direction,
            {
                products: {
                    Product: (row) => row.Product || '',
                    Qty: (row) => row.Qty || 0,
                    Cash: (row) => row.Cash || 0,
                    Card: (row) => row.Card || 0,
                    Snapscan: (row) => row.Snapscan || 0,
                    Other: (row) => row.Other || 0,
                    Total: (row) => row.Total || 0,
                },
            }
        ),
        [productRows, tableSorts.products]
    );

    const sortedRefundRows = useMemo(
        () => sortRows(
            refundRows,
            'refunds',
            tableSorts.refunds.key,
            tableSorts.refunds.direction,
            {
                refunds: {
                    staffName: (row) => row.staffName || '',
                    item: (row) => row.item || '',
                    method: (row) => row.method || '',
                    reason: (row) => row.reason || '',
                    amount: (row) => row.amount || 0,
                },
            }
        ),
        [refundRows, tableSorts.refunds]
    );

    const sortedCrewRows = useMemo(
        () => sortRows(
            crewRows,
            'crew',
            tableSorts.crew.key,
            tableSorts.crew.direction,
            {
                crew: {
                    staffName: (row) => row.staffName || '',
                    transactions: (row) => row.transactions || 0,
                    averageSale: (row) => row.averageSale || 0,
                    total: (row) => row.total || 0,
                    mostPopularProduct: (row) => row.mostPopularProduct || '',
                },
            }
        ),
        [crewRows, tableSorts.crew]
    );

    const sortedVoucherRows = useMemo(
        () => sortRows(
            voucherRows,
            'vouchers',
            tableSorts.vouchers.key,
            tableSorts.vouchers.direction,
            {
                vouchers: {
                    voucherType: (row) => row.voucherType || '',
                    count: (row) => row.count || 0,
                    value: (row) => row.value || 0,
                },
            }
        ),
        [tableSorts.vouchers, voucherRows]
    );

    const reportSnapshot = useMemo(() => ({
        scopeStoreLabel,
        dateRange,
        salesReconciliation,
        specialsBreakdown: sortedSpecialsRows,
        transactionHistory: sortedTransactionHistory,
        productRows: sortedProductRows,
        productTotalsSum: sumAggregateProductTotals(salesTotals),
        refundTotals: sortedRefundRows,
        staffTotals: sortedCrewRows,
        voucherStats,
        voucherRows: sortedVoucherRows,
        calculatedStats,
    }), [
        calculatedStats,
        dateRange,
        sortedCrewRows,
        sortedProductRows,
        sortedRefundRows,
        salesReconciliation,
        salesTotals,
        scopeStoreLabel,
        sortedTransactionHistory,
        voucherStats,
        sortedVoucherRows,
        sortedSpecialsRows,
    ]);

    const handleStoreChange = (value) => setSelectedStore(value);
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
    
    const handleExportToPdf = async () => {
        const blob = await buildReportsPdfBlob(reportSnapshot);
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
                                        <Select value={selectedStore} onValueChange={handleStoreChange}>
                                            <SelectTrigger id="storeSelect" className="h-11 rounded-2xl border-white/10 bg-neutral-900/80 text-white">
                                                <SelectValue placeholder="Select store" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="All stores">All stores</SelectItem>
                                                {stores.map((store) => (
                                                    <SelectItem key={store.id} value={store.id}>
                                                        {store.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : staffAuth?.accountType === 'staff' ? (
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-neutral-300">Store</label>
                                        <Input
                                            readOnly
                                            value={stores.find(store => store.id === user?.email)?.name || user?.email || 'Loading...'}
                                            className="h-11 rounded-2xl border-white/10 bg-neutral-900/80 text-white"
                                        />
                                    </div>
                                ) : null}
                                <div>
                                    <label htmlFor="startDate" className="mb-1 block text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">Start Date</label>
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={dateRange.start}
                                        onChange={(e) => handleDateChange(e, 'start')}
                                        className="h-12 rounded-3xl border-white/10 bg-neutral-950/70 px-4 text-sm text-white shadow-inner shadow-black/20 placeholder:text-neutral-500 focus-visible:border-cyan-400/40 focus-visible:ring-cyan-400/20"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="endDate" className="mb-1 block text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">End Date</label>
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={dateRange.end}
                                        onChange={(e) => handleDateChange(e, 'end')}
                                        className="h-12 rounded-3xl border-white/10 bg-neutral-950/70 px-4 text-sm text-white shadow-inner shadow-black/20 placeholder:text-neutral-500 focus-visible:border-cyan-400/40 focus-visible:ring-cyan-400/20"
                                    />
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-white/10 bg-neutral-900/70 text-neutral-200 hover:border-white/15 hover:bg-white/5 hover:text-white"
                                    onClick={() => applyPreset('today')}
                                >
                                    Today
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-white/10 bg-neutral-900/70 text-neutral-200 hover:border-white/15 hover:bg-white/5 hover:text-white"
                                    onClick={() => applyPreset('7d')}
                                >
                                    7 days
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-white/10 bg-neutral-900/70 text-neutral-200 hover:border-white/15 hover:bg-white/5 hover:text-white"
                                    onClick={() => applyPreset('mtd')}
                                >
                                    Month to date
                                </Button>
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
                            <Button
                                onClick={handleExportToPdf}
                                className="mt-3 h-11 w-full rounded-2xl bg-green-600 text-white shadow-md hover:bg-green-700 focus-visible:ring-green-500/30"
                                disabled={loading}
                            >
                                {loading ? 'Generating...' : 'Export to PDF'}
                            </Button>
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
                            <div className="mb-6 grid grid-cols-1 gap-3 text-neutral-300 lg:grid-cols-5 lg:gap-3">
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-snug shadow-sm"><strong className="text-neutral-200">Transactions:</strong> {calculatedStats.totalTransactions}</div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-snug shadow-sm"><strong className="text-neutral-200">Gross sales:</strong> R{salesReconciliation.gross.toFixed(2)}</div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-snug text-amber-300 shadow-sm"><strong className="text-neutral-200">Promotions:</strong> -R{salesReconciliation.promotions.toFixed(2)}</div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-snug text-green-300 shadow-sm"><strong className="text-neutral-200">Net sales:</strong> R{salesReconciliation.net.toFixed(2)}</div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-snug shadow-sm"><strong className="text-neutral-200">Refunds:</strong> R{calculatedStats.totalRefundsValue.toFixed(2)}</div>
                            </div>

                            <details className="mb-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5 open:shadow-lg open:shadow-black/10">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-white/5 px-3 py-2.5 text-sm font-semibold text-cyan-300 sm:text-base [&::-webkit-details-marker]:hidden">
                                    <span className="flex items-center gap-2">
                                        <span>Transaction History</span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-neutral-300 sm:text-xs">
                                            {sortedTransactionHistory.length}
                                        </span>
                                    </span>
                                    <span className="text-xs font-medium text-neutral-400">Tap to expand</span>
                                </summary>
                                <div className="border-t border-white/10">
                                    <p className="px-3 pb-2 pt-3 text-[11px] text-neutral-400 sm:text-xs">
                                        {sortedTransactionHistory.length} transactions in the selected scope.
                                    </p>
                                    {sortedTransactionHistory.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-[11px] text-cyan-100 sm:text-sm">
                                                <thead>
                                                    <tr className="bg-neutral-900/70">
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="transactions" sortKey="resolvedDate" sortState={tableSorts.transactions} onSort={handleTableSort} defaultDirection="desc">Time</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="transactions" sortKey="staffName" sortState={tableSorts.transactions} onSort={handleTableSort}>Staff</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="transactions" sortKey="paymentMethod" sortState={tableSorts.transactions} onSort={handleTableSort}>Method</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="transactions" sortKey="itemCount" sortState={tableSorts.transactions} onSort={handleTableSort} defaultDirection="desc">Items</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="transactions" sortKey="total" sortState={tableSorts.transactions} onSort={handleTableSort} defaultDirection="desc">Total</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="transactions" sortKey="storeName" sortState={tableSorts.transactions} onSort={handleTableSort}>Store</TableHeader></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sortedTransactionHistory.map((sale, index) => (
                                                        <Fragment key={sale.id || index}>
                                                        <tr className="border-b border-white/10 hover:bg-white/5">
                                                            <td className="px-2 py-1.5 text-neutral-200 sm:px-4 sm:py-2">
                                                                {sale.resolvedDate ? sale.resolvedDate.toLocaleString('en-ZA') : '--'}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">
                                                                <div className="max-w-[11rem] truncate">{sale.staffName || sale.createdBy?.name || 'Unknown'}</div>
                                                            </td>
                                                            <td className="px-2 py-1.5 capitalize text-neutral-300 sm:px-4 sm:py-2">
                                                                {sale.paymentMethod || 'unknown'}
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
                                                                <div className="max-w-[10rem] truncate">{sale.storeName}</div>
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
                                                                                        {item.label}
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
                            </details>

                            {sortedSpecialsRows.length > 0 && (
                                <details className="mb-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5 open:shadow-lg open:shadow-black/10">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-white/5 px-3 py-2.5 text-sm font-semibold text-amber-300 sm:text-base [&::-webkit-details-marker]:hidden">
                                        <span className="flex items-center gap-2">
                                            <span>Specials applied (period)</span>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-neutral-300 sm:text-xs">
                                                {sortedSpecialsRows.length}
                                            </span>
                                        </span>
                                        <span className="text-xs font-medium text-neutral-400">Tap to expand</span>
                                    </summary>
                                    <div className="border-t border-white/10">
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-[11px] text-amber-100 sm:text-sm">
                                                <thead>
                                                    <tr className="bg-neutral-900/70">
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="specials" sortKey="name" sortState={tableSorts.specials} onSort={handleTableSort}>Special</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="specials" sortKey="timesApplied" sortState={tableSorts.specials} onSort={handleTableSort} defaultDirection="desc">Times</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="specials" sortKey="totalSaved" sortState={tableSorts.specials} onSort={handleTableSort} defaultDirection="desc">Total saved</TableHeader></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sortedSpecialsRows.map((row) => (
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
                                </details>
                            )}

                            {/* Table 1: Product Sales */}
                            <details className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5 open:shadow-lg open:shadow-black/10">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-white/5 px-3 py-2.5 text-sm font-semibold text-green-300 sm:text-base [&::-webkit-details-marker]:hidden">
                                    <span className="flex items-center gap-2">
                                        <span>Product Sales Summary (net)</span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-neutral-300 sm:text-xs">
                                            {sortedProductRows.length}
                                        </span>
                                    </span>
                                    <span className="text-xs font-medium text-neutral-400">Tap to expand</span>
                                </summary>
                                <div className="border-t border-white/10">
                                    <p className="px-3 pb-2 pt-3 text-[11px] text-neutral-400 sm:text-xs">
                                        Product rows use sold item line totals and subtract specials only when the discounted product is known. Product total R{sumAggregateProductTotals(salesTotals).toFixed(2)}. Net sales after all promotions R{salesReconciliation.net.toFixed(2)}.
                                    </p>
                                    {sortedProductRows.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-[11px] text-green-100 sm:text-sm">
                                                <thead>
                                                    <tr className="bg-neutral-900/70">
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="products" sortKey="Product" sortState={tableSorts.products} onSort={handleTableSort}>Product</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="products" sortKey="Qty" sortState={tableSorts.products} onSort={handleTableSort} defaultDirection="desc">Qty</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="products" sortKey="Cash" sortState={tableSorts.products} onSort={handleTableSort} defaultDirection="desc">Cash</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="products" sortKey="Card" sortState={tableSorts.products} onSort={handleTableSort} defaultDirection="desc">Card</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="products" sortKey="Snapscan" sortState={tableSorts.products} onSort={handleTableSort} defaultDirection="desc">SnapScan</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="products" sortKey="Other" sortState={tableSorts.products} onSort={handleTableSort} defaultDirection="desc">Other</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="products" sortKey="Total" sortState={tableSorts.products} onSort={handleTableSort} defaultDirection="desc">Total</TableHeader></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sortedProductRows.map((sale, index) => (
                                                        <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                                                            <td className="px-2 py-1.5 text-neutral-200 sm:px-4 sm:py-2">{sale.Product}</td>
                                                            <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">{sale.Qty}</td>
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
                            </details>

                            {/* Table 2: Refunds */}
                            <details className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5 open:shadow-lg open:shadow-black/10">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-white/5 px-3 py-2.5 text-sm font-semibold text-red-300 sm:text-base [&::-webkit-details-marker]:hidden">
                                    <span className="flex items-center gap-2">
                                        <span>Refunds Issued</span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-neutral-300 sm:text-xs">
                                            {sortedRefundRows.length}
                                        </span>
                                    </span>
                                    <span className="text-xs font-medium text-neutral-400">Tap to expand</span>
                                </summary>
                                <div className="border-t border-white/10">
                                    {sortedRefundRows.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-[11px] text-red-100 sm:text-sm">
                                                <thead>
                                                    <tr className="bg-neutral-900/70">
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="refunds" sortKey="staffName" sortState={tableSorts.refunds} onSort={handleTableSort}>Staff</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="refunds" sortKey="item" sortState={tableSorts.refunds} onSort={handleTableSort}>Item</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="refunds" sortKey="method" sortState={tableSorts.refunds} onSort={handleTableSort}>Method</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="refunds" sortKey="reason" sortState={tableSorts.refunds} onSort={handleTableSort}>Reason</TableHeader></th>
                                                        <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="refunds" sortKey="amount" sortState={tableSorts.refunds} onSort={handleTableSort} defaultDirection="desc">Amount</TableHeader></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sortedRefundRows.map((refund, index) => (
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
                            </details>

                            {/* Table 3: Crew Performance */}
                            <details className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5 open:shadow-lg open:shadow-black/10">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-white/5 px-3 py-2.5 text-sm font-semibold text-blue-300 sm:text-base [&::-webkit-details-marker]:hidden">
                                    <span className="flex items-center gap-2">
                                        <span>Crew Performance</span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-neutral-300 sm:text-xs">
                                            {sortedCrewRows.length}
                                        </span>
                                    </span>
                                    <span className="text-xs font-medium text-neutral-400">Tap to expand</span>
                                </summary>
                                <div className="border-t border-white/10">
                                {sortedCrewRows.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-[11px] text-blue-100 sm:text-sm">
                                            <thead>
                                                <tr className="bg-neutral-900/70">
                                                    <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="crew" sortKey="staffName" sortState={tableSorts.crew} onSort={handleTableSort}>Staff</TableHeader></th>
                                                    <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="crew" sortKey="transactions" sortState={tableSorts.crew} onSort={handleTableSort} defaultDirection="desc">Transactions</TableHeader></th>
                                                    <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="crew" sortKey="averageSale" sortState={tableSorts.crew} onSort={handleTableSort} defaultDirection="desc">Avg Sale</TableHeader></th>
                                                    <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="crew" sortKey="total" sortState={tableSorts.crew} onSort={handleTableSort} defaultDirection="desc">Total Sales</TableHeader></th>
                                                    <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="crew" sortKey="mostPopularProduct" sortState={tableSorts.crew} onSort={handleTableSort}>Most Sold</TableHeader></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedCrewRows.map((staff, index) => (
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
                            </details>

                            {/* Voucher Table */}
                            <details className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5 open:shadow-lg open:shadow-black/10">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-white/5 px-3 py-2.5 text-sm font-semibold text-yellow-300 sm:text-base [&::-webkit-details-marker]:hidden">
                                    <span className="flex items-center gap-2">
                                        <span>Voucher Statistics</span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-neutral-300 sm:text-xs">
                                            {sortedVoucherRows.length}
                                        </span>
                                    </span>
                                    <span className="text-xs font-medium text-neutral-400">Tap to collapse</span>
                                </summary>
                                <div className="border-t border-white/10">
                                {sortedVoucherRows.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-[11px] text-yellow-100 sm:text-sm">
                                            <thead>
                                                <tr className="bg-neutral-900/70">
                                                    <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="vouchers" sortKey="voucherType" sortState={tableSorts.vouchers} onSort={handleTableSort}>Voucher Type</TableHeader></th>
                                                    <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="vouchers" sortKey="count" sortState={tableSorts.vouchers} onSort={handleTableSort} defaultDirection="desc">Count</TableHeader></th>
                                                    <th className="px-2 py-2 text-left sm:px-4"><TableHeader tableKey="vouchers" sortKey="value" sortState={tableSorts.vouchers} onSort={handleTableSort} defaultDirection="desc">Value</TableHeader></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedVoucherRows.map((voucher, index) => (
                                                    <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                                                        <td className="px-2 py-1.5 text-neutral-200 sm:px-4 sm:py-2">{voucher.voucherType}</td>
                                                        <td className="px-2 py-1.5 text-neutral-300 sm:px-4 sm:py-2">{voucher.count}</td>
                                                        <td className="px-2 py-1.5 text-yellow-200 sm:px-4 sm:py-2">R {voucher.value.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (<p className="p-3 text-neutral-400">No voucher usage data for this period/store.</p>)}
                                </div>
                            </details>

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
