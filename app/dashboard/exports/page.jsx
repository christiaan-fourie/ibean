'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import db from '../../../utils/firebase';
import { auth } from '../../../utils/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import RouteGuard from '../../components/RouteGuard';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);


// // Add helper functions at the top of the file
// const calculateProductTotals = (sales) => {
//     return sales.reduce((acc, sale) => {
//         const paymentMethod = sale.paymentMethod?.toLowerCase() || 'unknown';
        
//         sale.items?.forEach(item => {
//             const productName = item.name;
//             const itemTotal = parseFloat(item.price || 0) * parseInt(item.quantity || 0);
            
//             if (!acc[productName]) {
//                 acc[productName] = {
//                     cash: 0,
//                     card: 0,
//                     snapscan: 0,
//                     loyalty: 0,
//                     total: 0,
//                     quantity: 0
//                 };
//             }
            
//             acc[productName][paymentMethod] += itemTotal;
//             acc[productName].total += itemTotal;
//             acc[productName].quantity += parseInt(item.quantity || 0);
//         });
        
//         return acc;
//     }, {});
// };

// const calculateCrewStats = (sales) => {
//     return sales.reduce((acc, sale) => {
//         const staffName = sale.staffName || 'Unknown';
//         if (!acc[staffName]) {
//             acc[staffName] = {
//                 transactions: 0,
//                 total: 0,
//                 items: [],
//                 averageSale: 0
//             };
//         }
        
//         acc[staffName].transactions++;
//         acc[staffName].total += parseFloat(sale.totalPrice || 0);
//         sale.items?.forEach(item => {
//             const existingItem = acc[staffName].items.find(i => i.name === item.name);
//             if (existingItem) {
//                 existingItem.quantity += parseInt(item.quantity || 0);
//             } else {
//                 acc[staffName].items.push({
//                     name: item.name,
//                     quantity: parseInt(item.quantity || 0)
//                 });
//             }
//         });
        
//         acc[staffName].averageSale = acc[staffName].total / acc[staffName].transactions;
//         return acc;
//     }, {});
// };

// const calculatePeakHour = (sales) => {
//     const hourCounts = sales.reduce((acc, sale) => {
//         const hour = new Date(sale.timestamp).getHours();
//         acc[hour] = (acc[hour] || 0) + 1;
//         return acc;
//     }, {});
//     const peakHour = Object.entries(hourCounts)
//         .sort(([,a], [,b]) => b - a)[0];
//     return peakHour ? `${peakHour[0]}:00 - ${parseInt(peakHour[0]) + 1}:00` : 'N/A';
// };

// const calculateBestDay = (sales) => {
//     const dayCounts = sales.reduce((acc, sale) => {
//         const day = new Date(sale.timestamp).toLocaleDateString('en-US', { weekday: 'long' });
//         acc[day] = (acc[day] || 0) + parseFloat(sale.totalPrice || 0);
//         return acc;
//     }, {});
//     const bestDay = Object.entries(dayCounts)
//         .sort(([,a], [,b]) => b - a)[0];
//     return bestDay ? `${bestDay[0]} (R${bestDay[1].toFixed(2)})` : 'N/A';
// };

// const calculateTopPaymentMethod = (sales) => {
//     const methodCounts = sales.reduce((acc, sale) => {
//         const method = sale.paymentMethod || 'unknown';
//         acc[method] = (acc[method] || 0) + parseFloat(sale.totalPrice || 0);
//         return acc;
//     }, {});
//     const topMethod = Object.entries(methodCounts)
//         .sort(([,a], [,b]) => b - a)[0];
//     return topMethod ? `${topMethod[0]} (R${topMethod[1].toFixed(2)})` : 'N/A';
// };

// const calculateRefundRate = (sales, refunds) => {
//     const totalSales = sales.reduce((sum, sale) => sum + parseFloat(sale.totalPrice || 0), 0);
//     const totalRefunds = refunds.reduce((sum, refund) => sum + parseFloat(refund.amount || 0), 0);
//     return totalSales > 0 ? ((totalRefunds / totalSales) * 100).toFixed(1) : '0.0';
// };

// const calculateAvgItemsPerSale = (sales) => {
//     const totalItems = sales.reduce((sum, sale) => 
//         sum + (sale.items?.reduce((itemSum, item) => itemSum + parseInt(item.quantity || 0), 0) || 0), 0);
//     return sales.length > 0 ? (totalItems / sales.length).toFixed(1) : '0.0';
// };

// const calculateRevenuePerHour = (sales) => {
//     const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.totalPrice || 0), 0);
//     const hours = sales.length > 0 ? 
//         (Math.max(...sales.map(s => new Date(s.timestamp))) - 
//          Math.min(...sales.map(s => new Date(s.timestamp)))) / (1000 * 60 * 60) : 0;
//     return hours > 0 ? totalRevenue / hours : 0;
// };




export default function Exports() {
    const [staffAuth, setStaffAuth] = useState(null);
    const [storeData, setStoreData] = useState({
        sales: [],
        products: [],
        specials: [],
        staff: [],
        vouchers: [],
        refunds: []
    });
    const [dateRange, setDateRange] = useState({ 
        start: new Date().toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
    });
    const [stores] = useState([
        { id: 'zeven@iclick.co.za', name: 'Zevenwacht Mall' },
        { id: 'westgate@iclick.co.za', name: 'Westgate Mall' }
    ]);
    const [selectedStore, setSelectedStore] = useState('All stores');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Add staff auth check
      useEffect(() => {
        const auth = localStorage.getItem('staffAuth');
        if (auth) {
          setStaffAuth(JSON.parse(auth));
        }
      }, []);

    
    // Fetch store data on component mount
    useEffect(() => {
        const fetchStoreData = async () => {
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
            

            setStoreData({ sales: salesData, products: productsData, specials: specialsData, staff: staffData, vouchers: voucherData, refunds: refundData });
        } catch (error) {
            console.error('Error fetching store data:', error);
        }
        };

        fetchStoreData();
    }, []);


    const generateAIAnalysis = async () => {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const analysisPrompt = `You are an AI assistant for the Chilzone coffee shop's dashboard POS system (called iBean). Located in South Africa Using Rand (R).
        You are currently helping ${staffAuth.staffName} who is a ${staffAuth.accountType}.

        Current store data:
        Products: ${JSON.stringify(storeData.products)}
        Sales: ${JSON.stringify(storeData.sales)}
        Specials: ${JSON.stringify(storeData.specials)}
        Staff: ${JSON.stringify(storeData.staff)}
        Vouchers: ${JSON.stringify(storeData.vouchers)}
        Refunds: ${JSON.stringify(storeData.refunds)}
        Sales Report: ${selectedStore === 'All stores' ? 'All Stores' : selectedStore}
        Generated by: ${staffAuth?.staffName}
        Date: ${new Date().toLocaleString()}
        Period: ${dateRange.start} to ${dateRange.end}     
        
        Store to Report: ${selectedStore}        
        Period: ${dateRange.start} to ${dateRange.end}

        Please provide in HTML Format: (Sample Export)

        Table 1: Sales Totals
        ['Product', 'Cash', 'Card', 'Loyalty', 'SnapScan', 'Total']

        Table 2: Refunds
        ['Staff Member', 'Item', 'Method', 'Reason', 'Amount']

        Table 3: Crew Performance
        ['Staff Member', 'Transactions', 'Avg Sale', 'Total Sales', 'Most Popular Product']

        Additional Stats:
        ['Peak Hour', calculatePeakHour(sales)]
        ['Best Day', calculateBestDay(sales)]
        ['Most Used Payment', calculateTopPaymentMethod(sales)]
        ['Refund Rate']
        ['Average Items Per Sale']
        ['Revenue Per Hour']

        Please provide rich, formatted responses using HTML and inline styles. You should use this formats:

        Tables:
        <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
            <thead style="background-color: #1f2937;">
            <tr>
                <th style="padding: 8px; border: 1px solid #374151; color: #ffffff;">Header 1</th>
            </tr>
            </thead>
            <tbody>
            <tr style="background-color: #111827;">
                <td style="padding: 8px; border: 1px solid #374151;">Data 1</td>
            </tr>
            </tbody>
        </table>

        Styled Elements:
        - <div style="background-color: #1f2937; padding: 10px; border-radius: 5px; margin: 10px 0;">Boxes</div>
        - <span style="color: #10b981;">Success Text</span>
        - <span style="color: #ef4444;">Error Text</span>
        - <span style="color: #f59e0b;">Warning Text</span>
        - <span style="font-size: 1.25em; font-weight: bold;">Large Bold Text</span>

        Format data appropriately based on the context and make it visually appealing. Please no contextual information, just the data.

        
        
        `;

        try {
            const result = await model.generateContent(analysisPrompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Error generating AI analysis:', error);
            throw new Error('Failed to generate AI analysis');
        }
    };

    const generateReport = async () => {
        if (!selectedStore) {
            setError('Please select a store');
            return;
        }
    
        if (!dateRange.start || !dateRange.end) {
            setError('Please select a date range');
            return;
        }
        setLoading(true);
        setError('');       

        try {  

            // Generate AI analysis
            const analysis = await generateAIAnalysis();

            // Create PDF
            generatePDF(analysis);

        } catch (error) {
            console.error('Error generating report:', error);
            setError(error.message || 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const generatePDF = (aiAnalysis) => {

        // Extract HTML content from the AI analysis
        const parser = new DOMParser();
        const doc = parser.parseFromString(aiAnalysis, 'text/html');



        // Save the PDF
        const pdf = new jsPDF();

        autoTable(pdf, {
            html: doc.body,
            styles: {
                fontSize: 10,
                cellPadding: 2,
                overflow: 'linebreak',
                lineHeight: 1.5,
                font: 'helvetica',
                halign: 'center',
                valign: 'middle',
            },
            theme: 'grid',
        });

        pdf.save(`AI_Report_${new Date().toISOString()}.pdf`);

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

                        <button
                            onClick={generateReport}
                            disabled={loading}
                            className="w-full p-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading ? 'Generating AI Report...' : 'Generate AI-Enhanced Report'}
                        </button>
                    </div>
                </div>
                {storeData.sales.map((sale, index) => (
                    <div key={index} className="bg-neutral-800 p-4 rounded-lg shadow-lg mt-4">
                        <h2 className="text-xl font-semibold text-white">Sale ID: {sale.id}</h2>
                        <p className="text-neutral-400">Total Price: R{sale.finalTotal}</p>
                        <p className="text-neutral-400">Payment Method: {sale.payment?.method || null} </p>
                        <p className="text-neutral-400">Staff Name: {sale.staffName}</p>
                    </div>
                ))}

            </div>
        </RouteGuard>
    );
}