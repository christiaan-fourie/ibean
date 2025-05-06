'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import db from '../../../utils/firebase';
import { auth } from '../../../utils/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import RouteGuard from '../../components/RouteGuard';


// Helper function to calculate totals
const calculateTotals = (salesTotals) => {
    return salesTotals.reduce((acc, sale) => ({
        product: 'TOTAL',
        cash: acc.cash + sale.cash,
        card: acc.card + sale.card,
        loyalty: acc.loyalty + sale.loyalty,
        snapscan: acc.snapscan + sale.snapscan,
        total: acc.total + sale.total
    }), {
        product: 'TOTAL',
        cash: 0,
        card: 0,
        loyalty: 0,
        snapscan: 0,
        total: 0
    });
};

// Add these helper functions after the state declarations
const processData = (data, selectedStore, dateRange) => {
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    // Filter sales by date and store
    const filteredSales = data.sales.filter(sale => {
        const saleDate = new Date(sale.timestamp);
        const isDateInRange = saleDate >= startDate && saleDate <= endDate;
        const isStoreMatch = selectedStore === 'All stores' || sale.storeEmail === selectedStore;
        return isDateInRange && isStoreMatch;
    });

    // Calculate sales totals
    const newSalesTotals = filteredSales.reduce((acc, sale) => {
        sale.items.forEach(item => {
            const existingProduct = acc.find(p => p.product === item.name);
            if (!existingProduct) {
                acc.push({
                    product: item.name,
                    cash: sale.payment?.method === 'cash' ? item.price * item.quantity : 0,
                    card: sale.payment?.method === 'card' ? item.price * item.quantity : 0,
                    loyalty: sale.payment?.method === 'loyalty' ? item.price * item.quantity : 0,
                    snapscan: sale.payment?.method === 'snapscan' ? item.price * item.quantity : 0,
                    total: item.price * item.quantity
                });
            } else {
                existingProduct[sale.paymentMethod.toLowerCase()] += item.price * item.quantity;
                existingProduct.total += item.price * item.quantity;
            }
        });
        return acc;
    }, []);

    // Calculate staff totals
    const newStaffTotals = filteredSales.reduce((acc, sale) => {
        const staffMember = data.staff.find(s => s.id === sale.staffId);
        const existingStaff = acc.find(s => s.staffName === (staffMember?.name || 'Unknown'));
        
        if (!existingStaff) {
            acc.push({
                staffName: staffMember?.name || 'Unknown',
                transactions: 1,
                total: sale.total,
                items: sale.items.map(i => ({ name: i.name, count: 1 })),
                averageSale: sale.total
            });
        } else {
            existingStaff.transactions += 1;
            existingStaff.total += sale.total;
            existingStaff.averageSale = existingStaff.total / existingStaff.transactions;
            sale.items.forEach(item => {
                const existingItem = existingStaff.items.find(i => i.name === item.name);
                if (existingItem) existingItem.count += 1;
                else existingStaff.items.push({ name: item.name, count: 1 });
            });
            existingStaff.items.sort((a, b) => b.count - a.count);
        }
        return acc;
    }, []);

    // Calculate refund totals
    const newRefundTotals = data.refunds
        .filter(refund => {
            const refundDate = new Date(refund.timestamp);
            const isDateInRange = refundDate >= startDate && refundDate <= endDate;
            const isStoreMatch = selectedStore === 'All stores' || refund.storeEmail === selectedStore;
            return isDateInRange && isStoreMatch;
        })
        .map(refund => ({
            staffName: data.staff.find(s => s.id === refund.staffId)?.name || 'Unknown',
            item: refund.item,
            method: refund.method,
            reason: refund.reason,
            amount: refund.amount
        }));

    return {
        salesTotals: newSalesTotals,
        staffTotals: newStaffTotals,
        refundTotals: newRefundTotals
    };
};


export default function Exports() {
    const [staffAuth, setStaffAuth] = useState(null);
    const [allData, setAllData] = useState({
        sales: [],
        products: [],
        specials: [],
        staff: [],
        vouchers: [],
        refunds: []
    });
    // State for date range -- default to this first and last day of the current month
    const [dateRange, setDateRange] = useState({ 
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
    });
    const [stores] = useState([
        { id: 'zeven@iclick.co.za', name: 'Zevenwacht Mall' },
        { id: 'westgate@iclick.co.za', name: 'Westgate Mall' }
    ]);
    const [salesTotals, setSalesTotals] = useState([]);  // Change from initial object to empty array
    const [staffTotals, setStaffTotals] = useState([]); 
    const [refundTotals, setRefundTotals] = useState([]);
    const [selectedStore, setSelectedStore] = useState('All stores');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Functions

    // Fetch All Data
    const fetchAllData = async () => {
        try {
            const salesData = [];
            const productsData = [];
            const specialsData = [];
            const staffData = [];
            const refundData = [];
            const voucherData = [];

            // Fetch sales
            const salesSnapshot = await getDocs(collection(db, 'sales'));
            salesSnapshot.forEach(doc => salesData.push({ id: doc.id, ...doc.data() }));

            // Fetch products
            const productsSnapshot = await getDocs(collection(db, 'products'));
            productsSnapshot.forEach(doc => productsData.push({ id: doc.id, ...doc.data() }));

            // Fetch specials
            const specialsSnapshot = await getDocs(collection(db, 'specials'));
            specialsSnapshot.forEach(doc => specialsData.push({ id: doc.id, ...doc.data() }));

            // Fetch staff
            const staffSnapshot = await getDocs(collection(db, 'staff'));
            staffSnapshot.forEach(doc => staffData.push({ id: doc.id, ...doc.data() }));

            // Fetch refunds
            const refundsSnapshot = await getDocs(collection(db, 'refunds'));
            refundsSnapshot.forEach(doc => refundData.push({ id: doc.id, ...doc.data() }));

            // Fetch vouchers
            const vouchersSnapshot = await getDocs(collection(db, 'vouchers'));
            vouchersSnapshot.forEach(doc => voucherData.push({ id: doc.id, ...doc.data() }));
            

            setAllData({ sales: salesData, products: productsData, specials: specialsData, staff: staffData, vouchers: voucherData, refunds: refundData });
        } catch (error) {
            console.error('Error fetching store data:', error);
        }
    };

   

    // Add staff auth check
      useEffect(() => {
        const auth = localStorage.getItem('staffAuth');
        if (auth) {
          setStaffAuth(JSON.parse(auth));
        }
    }, []);

    
    // Replace existing useEffect hooks with these
    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        if (!allData.sales.length) return;
        
        setLoading(true);
        setError('');  // Clear any previous errors
        
        try {
            const { salesTotals: newSalesTotals, staffTotals: newStaffTotals, refundTotals: newRefundTotals } = 
                processData(allData, selectedStore, dateRange);
            
            // Only update state if we have valid data
            if (newSalesTotals?.length) {
                setSalesTotals(newSalesTotals);
            }
            if (newStaffTotals?.length) {
                setStaffTotals(newStaffTotals);
            }
            if (newRefundTotals?.length) {
                setRefundTotals(newRefundTotals);
            }
        } catch (error) {
            console.error('Error processing data:', error);
            setError('Error processing data: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, [allData, selectedStore, dateRange]);

    // Update the store change handler
    const handleStoreChange = (storeId) => {
        setSelectedStore(storeId);
    };

    // Update the date range change handler
    const handleDateRangeChange = (start, end) => {
        setDateRange({ start, end });
    };

    return (
        <RouteGuard requiredRoles={['manager']}>
            <div className="min-h-screen bg-neutral-900 p-8">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-white mb-8">AI-Enhanced Reports</h1>

                    {/* Store Selection */}
                    {staffAuth?.accountType === 'manager' && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-neutral-300 mb-1">
                                Select Store
                            </label>
                            <select
                                value={selectedStore}
                                onChange={(e) => setSelectedStore(e.target.value)}
                                className="w-full p-2 bg-neutral-700 rounded text-white"
                            >
                                <option value="All stores">All stores</option>
                                {stores.map(store => (
                                    <option 
                                        key={store.id} 
                                        value={store.id}
                                    >
                                        {store.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    
                    <div className="bg-neutral-800 p-6 rounded-lg shadow-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({
                                        ...prev,
                                        start: e.target.value
                                    }))}
                                    className="w-full p-2 bg-neutral-700 rounded text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({
                                        ...prev,
                                        end: e.target.value
                                    }))}
                                    className="w-full p-2 bg-neutral-700 rounded text-white"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-600/20 border border-red-500 rounded text-white">
                                {error}
                            </div>
                        )}                                               
                        {loading && (
                            <div className="mb-4 p-3 bg-blue-600/20 border border-blue-500 rounded text-white">
                                Loading data...
                            </div>
                        )}

                    </div>
                </div>
                
               
                <div className="mt-8 p-6 bg-neutral-800 rounded-lg shadow-lg">
                        <h2 className="text-xl font-bold text-white mb-4">Analysis Report </h2>
                        <h4> Store: {selectedStore} </h4>
                        <h4> Date Range: {dateRange.start} to {dateRange.end} </h4>

                        <h3> Total No of Sales: {allData.sales.length}   </h3>

                        {/* Table 1 ['Product', 'Cash', 'Card', 'Loyalty', 'SnapScan', 'Total'] */}
                        <div className="mt-4">
                            <h3>Sales Totals</h3>
                            <table className="min-w-full bg-neutral-800 border border-neutral-700">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-2 text-left text-neutral-300">Product</th>
                                        <th className="px-4 py-2 text-left text-neutral-300">Cash</th>
                                        <th className="px-4 py-2 text-left text-neutral-300">Card</th>
                                        <th className="px-4 py-2 text-left text-neutral-300">Loyalty</th>
                                        <th className="px-4 py-2 text-left text-neutral-300">SnapScan</th>
                                        <th className="px-4 py-2 text-left text-neutral-300">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salesTotals.map((sale, index) => (
                                        <tr key={index} className="border-b border-neutral-700">
                                            <td className="px-4 py-2 text-neutral-300">{sale.product}</td>
                                            <td className="px-4 py-2 text-neutral-300">R{sale.cash.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-neutral-300">R{sale.card.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-neutral-300">R{sale.loyalty.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-neutral-300">R{sale.snapscan.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-neutral-300">R{sale.total.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {salesTotals.length > 0 && (
                                        <tr className="border-t-2 border-neutral-600 font-bold">
                                            <td className="px-4 py-2 text-neutral-300">TOTAL</td>
                                            <td className="px-4 py-2 text-neutral-300">
                                                R{calculateTotals(salesTotals).cash.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-2 text-neutral-300">
                                                R{calculateTotals(salesTotals).card.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-2 text-neutral-300">
                                                R{calculateTotals(salesTotals).loyalty.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-2 text-neutral-300">
                                                R{calculateTotals(salesTotals).snapscan.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-2 text-neutral-300">
                                                R{calculateTotals(salesTotals).total.toFixed(2)}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Table 2 ['Staff Member', 'Item', 'Method', 'Reason', 'Amount'] */}
                        <div className="mt-4">
                            <h3>Refunds</h3>
                            <table className="min-w-full bg-neutral-800 border border-neutral-700">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-2 text-left text-neutral-300">Staff Member</th>
                                        <th className="px-4 py-2 text-left text-neutral-300">Item</th>
                                        <th className="px-4 py-2 text-left text-neutral-300">Method</th>
                                        <th className="px-4 py-2 text-left text-neutral-300">Reason</th>
                                        <th className="px-4 py-2 text-left text-neutral-300">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {refundTotals.map((refund, index) => (
                                        <tr key={index} className="border-b border-neutral-700">
                                            <td className="px-4 py-2 text-neutral-300">{refund.staffName || 'Unknown'}</td>
                                            <td className="px-4 py-2 text-neutral-300">{refund.item || 'Unknown'}</td>
                                            <td className="px-4 py-2 text-neutral-300">{refund.method || 'Unknown'}</td>
                                            <td className="px-4 py-2 text-neutral-300">{refund.reason || 'Unknown'}</td>
                                            <td className="px-4 py-2 text-neutral-300">R{refund.amount.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Table 3 ['Staff Member', 'Transactions', 'Avg Sale', 'Total Sales', 'Most Popular Product'] */}
                        <div className="mt-4">
                            <h3>Crew Performance</h3>
                            <table className="min-w-full bg-neutral-800 border border-neutral-700">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-2 text-left text-neutral-300">Staff Member</th>
                                        <th className="px-4 py-2 text-left text-neutral-300">Transactions</th>
                                        <th className="px-4 py-2 text-left text-neutral-300">Avg Sale</th>
                                        <th className="px-4 py-2 text-left text-neutral-300">Total Sales</th>
                                        <th className="px-4 py-2 text-left text-neutral-300">Most Popular Product</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffTotals.map((staff, index) => (
                                        <tr key={index} className="border-b border-neutral-700">
                                            <td className="px-4 py-2 text-neutral-300">{staff.staffName || 'Unknown'}</td>
                                            <td className="px-4 py-2 text-neutral-300">{staff.transactions}</td>
                                            <td className="px-4 py-2 text-neutral-300">R{staff.averageSale.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-neutral-300">R{staff.total.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-neutral-300">{staff.items[0]?.name || 'Unknown'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Additional Stats */}
                        <div className="mt-4">
                            <h3>Additional Stats</h3>
                            <ul className="list-disc pl-6">
                                <li className="text-neutral-300">Peak Hour: {allData.peakHour || 'N/A'}</li>
                                <li className="text-neutral-300">Best Day: {allData.bestDay || 'N/A'}</li>
                                <li className="text-neutral-300">Most Used Payment: {allData.topPaymentMethod || 'N/A'}</li>
                                <li className="text-neutral-300">Refund Rate: {allData.refundRate || '0.0'}%</li>
                                <li className="text-neutral-300">Average Items Per Sale: {allData.avgItemsPerSale || '0.0'}</li>
                                <li className="text-neutral-300">Revenue Per Hour: R{allData.revenuePerHour?.toFixed(2) || '0.00'}</li>
                            </ul>
                        </div>


                        {!allData && (
                            <div className="mb-4">
                                <p className="text-neutral-400">No data available for the selected date range.</p>
                            </div>
                        )}
                        {!loading && salesTotals.length === 0 && (
                            <div className="mb-4 p-3 bg-yellow-600/20 border border-yellow-500 rounded text-white">
                                No sales data available for the selected criteria
                            </div>
                        )}
                        

                </div>
                
            </div>
        </RouteGuard>
    );
}