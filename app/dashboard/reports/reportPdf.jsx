'use client';

import React from 'react';
import { pdf, Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 46,
    fontFamily: 'Helvetica',
    backgroundColor: '#F8FAFC',
  },
  header: {
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'solid',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerTextBlock: {
    flex: 1,
    paddingRight: 10,
  },
  scopePill: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    color: '#1D4ED8',
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dateChip: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    color: '#475569',
    fontSize: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 10.5,
    color: '#334155',
  },
  meta: {
    marginTop: 4,
    fontSize: 9,
    color: '#64748B',
  },
  metricGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '31.5%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'solid',
  },
  metricLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    marginTop: 3,
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  metricSub: {
    marginTop: 2,
    fontSize: 7.5,
    color: '#64748B',
  },
  sectionHeader: {
    marginTop: 12,
    marginBottom: 7,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    borderBottomStyle: 'solid',
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  description: {
    marginBottom: 6,
    fontSize: 8,
    lineHeight: 1.35,
    color: '#475569',
  },
  table: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'solid',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    borderBottomStyle: 'solid',
    backgroundColor: '#FFFFFF',
  },
  rowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    borderBottomStyle: 'solid',
    backgroundColor: '#F8FAFC',
  },
  headerCell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: '#0F172A',
    borderRightWidth: 1,
    borderRightColor: '#334155',
    borderRightStyle: 'solid',
  },
  cell: {
    flex: 1,
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    fontSize: 7.8,
    color: '#334155',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    borderRightStyle: 'solid',
  },
  highlightCell: {
    flex: 1,
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    fontSize: 7.8,
    fontWeight: 'bold',
    color: '#0F172A',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    borderRightStyle: 'solid',
  },
  transactionItems: {
    marginTop: 2,
    fontSize: 7.4,
    lineHeight: 1.25,
    color: '#475569',
  },
  miniStatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  miniStatItem: {
    width: '31.5%',
    marginBottom: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'solid',
  },
  miniStatLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniStatValue: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  footer: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 12,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    borderTopStyle: 'solid',
    textAlign: 'center',
    fontSize: 7.5,
    color: '#94A3B8',
  },
});

const formatMoney = (value) => `R ${Number(value || 0).toFixed(2)}`;

const formatDate = (value) => {
  if (!value) return '--';
  try {
    return new Date(value).toLocaleString('en-ZA');
  } catch {
    return '--';
  }
};

const renderInlineItems = (items) => {
  if (!items || items.length === 0) return 'Items: No items recorded';
  return `Items: ${items
    .map((item) => `${item.quantity}x ${item.label} - ${formatMoney(item.lineTotal)}`)
    .join('  ·  ')}`;
};

const sectionBreakProps = { minPresenceAhead: 72 };

const tableRowProps = { wrap: false };

const ReportsPdfDocument = ({ report }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.scopePill}>Sales report</Text>
            <Text style={styles.title}>iBEAN Sales Analysis</Text>
            <Text style={styles.subtitle}>{report.scopeStoreLabel}</Text>
            <Text style={styles.meta}>
              {report.dateRange.start} to {report.dateRange.end}
            </Text>
          </View>
          <Text style={styles.dateChip}>{new Date().toLocaleDateString('en-ZA')}</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.metricCard} wrap={false}>
            <Text style={styles.metricLabel}>Gross</Text>
            <Text style={styles.metricValue}>{formatMoney(report.salesReconciliation.gross)}</Text>
            <Text style={styles.metricSub}>Before promotions</Text>
          </View>
          <View style={styles.metricCard} wrap={false}>
            <Text style={styles.metricLabel}>Net</Text>
            <Text style={styles.metricValue}>{formatMoney(report.salesReconciliation.net)}</Text>
            <Text style={styles.metricSub}>After promotions</Text>
          </View>
          <View style={styles.metricCard} wrap={false}>
            <Text style={styles.metricLabel}>Transactions</Text>
            <Text style={styles.metricValue}>{report.transactionHistory.length}</Text>
            <Text style={styles.metricSub}>In selected scope</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionHeader} minPresenceAhead={sectionBreakProps.minPresenceAhead}>
        Sales Reconciliation
      </Text>
      <View style={styles.miniStatGrid} wrap={false}>
        <View style={styles.miniStatItem} wrap={false}>
          <Text style={styles.miniStatLabel}>Promotions</Text>
          <Text style={styles.miniStatValue}>-{formatMoney(report.salesReconciliation.promotions)}</Text>
        </View>
        <View style={styles.miniStatItem} wrap={false}>
          <Text style={styles.miniStatLabel}>Avg items/sale</Text>
          <Text style={styles.miniStatValue}>{report.calculatedStats.avgItemsPerSale}</Text>
        </View>
        <View style={styles.miniStatItem} wrap={false}>
          <Text style={styles.miniStatLabel}>Refund rate</Text>
          <Text style={styles.miniStatValue}>{report.calculatedStats.refundRate}%</Text>
        </View>
      </View>
      <View style={styles.table}>
        <View style={styles.row} {...tableRowProps}>
          <Text style={styles.headerCell}>Gross</Text>
          <Text style={styles.headerCell}>Promotions</Text>
          <Text style={styles.headerCell}>Net</Text>
        </View>
        <View style={styles.rowAlt} {...tableRowProps}>
          <Text style={styles.highlightCell}>{formatMoney(report.salesReconciliation.gross)}</Text>
          <Text style={styles.highlightCell}>-{formatMoney(report.salesReconciliation.promotions)}</Text>
          <Text style={styles.highlightCell}>{formatMoney(report.salesReconciliation.net)}</Text>
        </View>
      </View>

      {report.specialsBreakdown.length > 0 && (
        <>
          <Text style={styles.sectionHeader} minPresenceAhead={sectionBreakProps.minPresenceAhead}>
            Specials Applied
          </Text>
          <View style={styles.table}>
            <View style={styles.row} {...tableRowProps}>
              <Text style={styles.headerCell}>Special</Text>
              <Text style={styles.headerCell}>Times</Text>
              <Text style={styles.headerCell}>Total saved</Text>
            </View>
            {report.specialsBreakdown.map((row, index) => (
              <View
                key={row.id || `${row.name}-${index}`}
                style={index % 2 === 0 ? styles.row : styles.rowAlt}
                {...tableRowProps}
              >
                <Text style={styles.cell}>{row.name}</Text>
                <Text style={styles.cell}>{row.timesApplied}</Text>
                <Text style={styles.highlightCell}>{formatMoney(row.totalSaved)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={styles.sectionHeader} minPresenceAhead={sectionBreakProps.minPresenceAhead}>
        Transaction History
      </Text>
      <Text style={styles.description} minPresenceAhead={48}>
        {report.transactionHistory.length} transactions in the selected scope.
      </Text>
      <View style={styles.table}>
        <View style={styles.row} {...tableRowProps}>
          <Text style={styles.headerCell}>Date / Time</Text>
          <Text style={styles.headerCell}>Staff</Text>
          <Text style={styles.headerCell}>Method</Text>
          <Text style={styles.headerCell}>Items</Text>
          <Text style={styles.headerCell}>Total</Text>
        </View>
        {report.transactionHistory.map((sale, index) => (
          <React.Fragment key={sale.id || sale.orderNumber || index}>
            <View style={index % 2 === 0 ? styles.row : styles.rowAlt} {...tableRowProps}>
              <Text style={styles.cell}>{formatDate(sale.resolvedDate)}</Text>
              <Text style={styles.cell}>{sale.staffName || sale.createdBy?.name || 'Unknown'}</Text>
              <Text style={styles.cell}>{sale.payment?.method || 'unknown'}</Text>
              <Text style={styles.cell}>{sale.itemCount}</Text>
              <Text style={styles.highlightCell}>{formatMoney(sale.total)}</Text>
            </View>
            <View style={styles.rowAlt} {...tableRowProps}>
              <Text style={[styles.cell, { flex: 1, borderRightWidth: 0 }]}>
                {renderInlineItems(sale.pdfItems)}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      <Text style={styles.sectionHeader} minPresenceAhead={sectionBreakProps.minPresenceAhead}>
        Product Sales Summary (net)
      </Text>
      <Text style={styles.description} minPresenceAhead={48}>
        Sold item line totals with specials subtracted only when the discounted product is known. Product table: {formatMoney(report.productTotalsSum)} · Net sales after all promotions: {formatMoney(report.salesReconciliation.net)}.
      </Text>
      <View style={styles.table}>
        <View style={styles.row} {...tableRowProps}>
          <Text style={styles.headerCell}>Item</Text>
          <Text style={styles.headerCell}>Qty</Text>
          <Text style={styles.headerCell}>Cash</Text>
          <Text style={styles.headerCell}>Card</Text>
          <Text style={styles.headerCell}>SnapScan</Text>
          <Text style={styles.headerCell}>Other</Text>
          <Text style={styles.headerCell}>Total</Text>
        </View>
        {report.productRows.map((row, index) => (
          <View key={row.Product || index} style={index % 2 === 0 ? styles.row : styles.rowAlt} {...tableRowProps}>
            <Text style={styles.cell}>{row.Product}</Text>
            <Text style={styles.cell}>{row.Qty}</Text>
            <Text style={styles.cell}>{formatMoney(row.Cash)}</Text>
            <Text style={styles.cell}>{formatMoney(row.Card)}</Text>
            <Text style={styles.cell}>{formatMoney(row.Snapscan)}</Text>
            <Text style={styles.cell}>{formatMoney(row.Other)}</Text>
            <Text style={styles.highlightCell}>{formatMoney(row.Total)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionHeader} minPresenceAhead={sectionBreakProps.minPresenceAhead}>
        Refunds Issued
      </Text>
      <View style={styles.table}>
        <View style={styles.row} {...tableRowProps}>
          <Text style={styles.headerCell}>Crew Member</Text>
          <Text style={styles.headerCell}>Item</Text>
          <Text style={styles.headerCell}>Method</Text>
          <Text style={styles.headerCell}>Reason</Text>
          <Text style={styles.headerCell}>Amount</Text>
        </View>
        {report.refundTotals.map((refund, index) => (
          <View key={`${refund.staffName}-${index}`} style={index % 2 === 0 ? styles.row : styles.rowAlt} {...tableRowProps}>
            <Text style={styles.cell}>{refund.staffName}</Text>
            <Text style={styles.cell}>{refund.item}</Text>
            <Text style={styles.cell}>{refund.method}</Text>
            <Text style={styles.cell}>{refund.reason}</Text>
            <Text style={styles.highlightCell}>{formatMoney(refund.amount)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionHeader} minPresenceAhead={sectionBreakProps.minPresenceAhead}>
        Crew Performance
      </Text>
      <View style={styles.table}>
        <View style={styles.row} {...tableRowProps}>
          <Text style={styles.headerCell}>Crew Member</Text>
          <Text style={styles.headerCell}>Transactions</Text>
          <Text style={styles.headerCell}>Avg Sale</Text>
          <Text style={styles.headerCell}>Total Sales</Text>
          <Text style={styles.headerCell}>Most Sold Product</Text>
        </View>
        {report.staffTotals.map((staff, index) => (
          <View key={`${staff.staffName}-${index}`} style={index % 2 === 0 ? styles.row : styles.rowAlt} {...tableRowProps}>
            <Text style={styles.cell}>{staff.staffName}</Text>
            <Text style={styles.cell}>{staff.transactions}</Text>
            <Text style={styles.cell}>{formatMoney(staff.averageSale)}</Text>
            <Text style={styles.highlightCell}>{formatMoney(staff.total)}</Text>
            <Text style={styles.cell}>{staff.mostPopularProduct}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionHeader} minPresenceAhead={sectionBreakProps.minPresenceAhead}>
        Voucher Statistics
      </Text>
      <Text style={styles.description} minPresenceAhead={48}>
        Summary of voucher usage including discount percentages, fixed amount discounts, and free items.
      </Text>
      <View style={styles.table}>
        <View style={styles.row} {...tableRowProps}>
          <Text style={styles.headerCell}>Voucher Type</Text>
          <Text style={styles.headerCell}>Count</Text>
          <Text style={styles.headerCell}>Value</Text>
        </View>
        {Object.keys(report.voucherStats.voucherUsageByType).map((voucherType, index) => {
          const voucherRow = report.voucherStats.voucherUsageByType[voucherType];
          return (
            <View key={voucherType} style={index % 2 === 0 ? styles.row : styles.rowAlt} {...tableRowProps}>
              <Text style={styles.cell}>{voucherType}</Text>
              <Text style={styles.cell}>{voucherRow.count}</Text>
              <Text style={styles.highlightCell}>{formatMoney(voucherRow.value)}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionHeader} minPresenceAhead={sectionBreakProps.minPresenceAhead}>
        Summary Statistics
      </Text>
      <View style={styles.miniStatGrid} wrap={false}>
        {[
          { label: 'Peak Hour', value: report.calculatedStats.peakHour },
          { label: 'Busiest Day (Value)', value: report.calculatedStats.bestDay },
          { label: 'Most Used Payment', value: report.calculatedStats.topPaymentMethod },
          { label: 'Refund Rate', value: `${report.calculatedStats.refundRate}%` },
          { label: 'Avg Items/Sale', value: report.calculatedStats.avgItemsPerSale },
          { label: 'Revenue/Active Hour', value: formatMoney(report.calculatedStats.revenuePerHour) },
          { label: 'Total Vouchers Redeemed', value: report.voucherStats.totalVouchersRedeemed },
          { label: 'Total Voucher Value', value: formatMoney(report.voucherStats.totalVoucherValue) },
          { label: 'Most Popular Voucher Type', value: report.voucherStats.mostPopularVoucherType },
          { label: 'Percent Sales with Vouchers', value: `${report.voucherStats.percentSalesWithVouchers}%` },
        ].map((stat) => (
          <View key={stat.label} style={styles.miniStatItem} wrap={false}>
            <Text style={styles.miniStatLabel}>{stat.label}</Text>
            <Text style={styles.miniStatValue}>{stat.value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>
        Generated by iBEAN Management System • {new Date().toLocaleDateString()} • Confidential
      </Text>
    </Page>
  </Document>
);

export const buildReportsPdfBlob = async (report) => {
  return pdf(<ReportsPdfDocument report={report} />).toBlob();
};
