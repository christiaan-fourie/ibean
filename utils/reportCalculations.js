import { aggregateProductPaymentTotals } from './pricing/aggregateSales';
import { allocateNetToLineItems, getSaleNetTotal } from './pricing/saleAmounts';
import { fromCents, toCents } from './pricing/money';

function paymentBucket(method) {
    const normalized = (method || 'unknown').toLowerCase();
    if (normalized === 'cash') return 'Cash';
    if (normalized === 'card') return 'Card';
    if (normalized === 'snapscan') return 'Snapscan';
    return 'Other';
}

/** Gross revenue per product (line subtotals in ZAR). See utils/pricing. */
export function calculateProductPaymentTotals(salesData) {
    return aggregateProductPaymentTotals(salesData);
}

/** Net revenue per product, allocated pro-rata from each sale total. */
export function calculateProductNetTotals(salesData) {
    const productTotals = {};

    for (const sale of salesData || []) {
        const bucket = paymentBucket(sale.payment?.method);
        const allocatedLines = allocateNetToLineItems(sale);

        for (const line of allocatedLines) {
            const name = line.name || 'Unknown Product';
            const net = line.net || 0;
            if (!productTotals[name]) {
                productTotals[name] = {
                    Product: name,
                    Qty: 0,
                    Cash: 0,
                    Card: 0,
                    Snapscan: 0,
                    Other: 0,
                    Total: 0,
                    _cashCents: 0,
                    _cardCents: 0,
                    _snapscanCents: 0,
                    _otherCents: 0,
                    _totalCents: 0,
                };
            }
            const cents = Number.isInteger(line.netCents) ? line.netCents : toCents(net);
            const centsKey = `_${bucket.toLowerCase()}Cents`;
            productTotals[name].Qty += line.quantity || 0;
            productTotals[name][centsKey] += cents;
            productTotals[name]._totalCents += cents;
        }
    }

    Object.values(productTotals).forEach((row) => {
        row.Cash = fromCents(row._cashCents);
        row.Card = fromCents(row._cardCents);
        row.Snapscan = fromCents(row._snapscanCents);
        row.Other = fromCents(row._otherCents);
        row.Total = fromCents(row._totalCents);
        delete row._cashCents;
        delete row._cardCents;
        delete row._snapscanCents;
        delete row._otherCents;
        delete row._totalCents;
    });

    return productTotals;
}

export function calculateRefundTotals(refundData) {
    return refundData.map(refund => ({
        staffName: refund.staffName || 'Unknown',
        item: refund.productName || 'Unknown Item',
        method: refund.method || 'Unknown Method',
        reason: refund.reason || 'No reason provided',
        amount: parseFloat(refund.amount) || 0,
    }));
}

export function calculateStaffTotals(salesData) {
    const staffPerformance = {};
    salesData.forEach(sale => {
        const staffName = sale.staffName || 'Unknown Staff';
        const saleTotal = getSaleNetTotal(sale);
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
}

export function calculateVoucherStats(salesData, vouchersData, dateRange, selectedStore) {
    // Helper for date parsing
    const getStartOfDayFromString = (dateString) => {
        const date = new Date(dateString);
        date.setUTCHours(0, 0, 0, 0);
        return date;
    };
    const getEndOfDayFromString = (dateString) => {
        const date = new Date(dateString);
        date.setUTCHours(23, 59, 59, 999);
        return date;
    };

    const startDate = getStartOfDayFromString(dateRange.start);
    const endDate = getEndOfDayFromString(dateRange.end);

    const salesWithVouchers = salesData.filter(sale =>
        sale.payment?.method === 'voucher' || sale.voucher
    );

    const redeemedVouchers = vouchersData.filter(voucher => {
        if (!voucher.redeemed) return false;

        let redemptionDate;
        if (voucher.redeemedAt && voucher.redeemedAt.toDate) {
            redemptionDate = voucher.redeemedAt.toDate();
        } else if (typeof voucher.redeemedAt === 'string') {
            redemptionDate = new Date(voucher.redeemedAt);
        } else if (voucher.usedAt && voucher.usedAt.toDate) {
            redemptionDate = voucher.usedAt.toDate();
        } else if (typeof voucher.usedAt === 'string') {
            redemptionDate = new Date(voucher.usedAt);
        } else {
            return false;
        }

        const storeMatch = selectedStore === 'All stores' ||
            voucher.redeemedBy?.storeId === selectedStore ||
            voucher.usedBy?.storeId === selectedStore;

        const dateMatch = redemptionDate >= startDate && redemptionDate <= endDate;
        return storeMatch && dateMatch;
    });

    const voucherTypes = {};
    let totalVoucherValue = 0;

    redeemedVouchers.forEach(voucher => {
        const voucherType = voucher.voucherType || 'unknown';
        if (!voucherTypes[voucherType]) {
            voucherTypes[voucherType] = { count: 0, value: 0 };
        }
        voucherTypes[voucherType].count += 1;

        let voucherValue = 0;
        if (voucher.voucherType === 'discount') {
            if (voucher.discountType === 'percentage') {
                const matchingSale = salesWithVouchers.find(sale =>
                    sale.voucher?.id === voucher.id ||
                    sale.voucher?.code === voucher.code
                );
                if (matchingSale) {
                    voucherValue = matchingSale.voucher?.value || 0;
                }
            } else if (voucher.discountType === 'fixed') {
                voucherValue = parseFloat(voucher.discountValue) || 0;
            }
        } else if (voucher.voucherType === 'freeItem') {
            const matchingSale = salesWithVouchers.find(sale =>
                sale.voucher?.id === voucher.id ||
                sale.voucher?.code === voucher.code
            );
            if (matchingSale && matchingSale.voucher?.value) {
                voucherValue = parseFloat(matchingSale.voucher.value) || 0;
            }
        }

        voucherTypes[voucherType].value += voucherValue;
        totalVoucherValue += voucherValue;
    });

    let mostPopularType = 'N/A';
    let maxCount = 0;
    for (const type in voucherTypes) {
        if (voucherTypes[type].count > maxCount) {
            mostPopularType = type;
            maxCount = voucherTypes[type].count;
        }
    }

    const percentWithVouchers = salesData.length > 0
        ? (salesWithVouchers.length / salesData.length * 100).toFixed(1)
        : 0;

    return {
        totalVouchersRedeemed: redeemedVouchers.length,
        totalVoucherValue,
        voucherUsageByType: voucherTypes,
        mostPopularVoucherType: mostPopularType,
        percentSalesWithVouchers: percentWithVouchers,
    };
}

export function calculateAdditionalStats(salesData, refundData) {
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
        else if (typeof sale.date === 'string') { saleDate = new Date(sale.date); }
        else if (sale.timestamp && sale.timestamp.toDate) { saleDate = sale.timestamp.toDate(); }
        else if (typeof sale.timestamp === 'string') { saleDate = new Date(sale.timestamp); }
        else { saleDate = new Date(); }

        const hour = saleDate.getHours();
        hourlySales[hour] = (hourlySales[hour] || 0) + 1;
        distinctSaleHours.add(hour);

        const day = saleDate.toLocaleDateString('en-US', { weekday: 'long' });
        dailySalesValue[day] = (dailySalesValue[day] || 0) + getSaleNetTotal(sale);

        const paymentMethod = sale.payment?.method?.toLowerCase() || 'unknown';
        paymentMethodsCount[paymentMethod] = (paymentMethodsCount[paymentMethod] || 0) + 1;

        sale.items.forEach(item => totalItemsSold += (item.quantity || 1));
        currentTotalSalesValue += getSaleNetTotal(sale);
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
}
