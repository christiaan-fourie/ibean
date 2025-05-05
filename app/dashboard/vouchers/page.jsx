'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { FaTrashAlt } from 'react-icons/fa';
import db from '../../../utils/firebase';
import RouteGuard from '../../components/RouteGuard';

export default function Vouchers() {
    const [vouchers, setVouchers] = useState([]);
    const [staffAuth, setStaffAuth] = useState(null);
    const [expirationDate, setExpirationDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Get staff authentication
    useEffect(() => {
        const auth = localStorage.getItem('staffAuth');
        if (auth) {
            setStaffAuth(JSON.parse(auth));
        }
    }, []);

    // Fetch existing vouchers
    useEffect(() => {
        const fetchVouchers = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'vouchers'));
                const voucherData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setVouchers(voucherData);
            } catch (error) {
                console.error('Error fetching vouchers:', error);
                setError('Failed to load vouchers');
            }
        };

        fetchVouchers();
    }, []);

    // Generate random voucher code
    const generateVoucherCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    // Handle voucher creation
    const handleCreateVoucher = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        if (!expirationDate) {
            setError('Please select an expiration date');
            setLoading(false);
            return;
        }

        try {
            const voucherCode = generateVoucherCode();
            const voucherData = {
                code: voucherCode,
                expirationDate: new Date(expirationDate).toISOString(),
                createdAt: new Date().toISOString(),
                createdBy: {
                    id: staffAuth.staffId,
                    name: staffAuth.staffName,
                    role: staffAuth.accountType
                },
                active: true
            };

            await addDoc(collection(db, 'vouchers'), voucherData);
            setVouchers([...vouchers, { ...voucherData }]);
            setSuccess('Voucher created successfully');
            setExpirationDate('');
        } catch (error) {
            console.error('Error creating voucher:', error);
            setError('Failed to create voucher');
        } finally {
            setLoading(false);
        }
    };

    // Handle voucher deletion
    const handleDeleteVoucher = async (voucherId) => {
        try {
            await deleteDoc(doc(db, 'vouchers', voucherId));
            setVouchers(vouchers.filter(v => v.id !== voucherId));
            setSuccess('Voucher deleted successfully');
        } catch (error) {
            console.error('Error deleting voucher:', error);
            setError('Failed to delete voucher');
        }
    };

    return (
        <RouteGuard requiredRoles={['manager']}>
            <div className="min-h-screen bg-neutral-900 p-8">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-white mb-8">Voucher Management</h1>

                    {/* Create Voucher Form */}
                    <form onSubmit={handleCreateVoucher} className="mb-8 p-4 bg-neutral-800 rounded-lg">
                        <div className="flex gap-4">
                            <h1>Exparation Date:</h1>
                            <input
                                type="date"
                                value={expirationDate}
                                onChange={(e) => setExpirationDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="flex-1 p-2 bg-neutral-700 rounded text-white"
                                required
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {loading ? 'Creating...' : 'Generate Voucher'}
                            </button>
                        </div>
                    </form>

                    {/* Messages */}
                    {error && <div className="mb-4 p-3 bg-red-600/20 border border-red-500 rounded">{error}</div>}
                    {success && <div className="mb-4 p-3 bg-green-600/20 border border-green-500 rounded">{success}</div>}

                    {/* Vouchers List */}
                    <div className="grid gap-4">
                        {vouchers.map(voucher => (
                            <div key={voucher} className="p-4 bg-neutral-800 rounded-lg flex justify-between items-center">
                                <div>
                                    <div className="text-xl flex gap-2 text-neutral-500 font-mono">
                                        {voucher.code}
                                        <button
                                            onClick={() => navigator.clipboard.writeText(voucher.code)}
                                            className="text-sm text-blue-400 hover:text-blue-300"
                                        >
                                            Copy                                            
                                        </button>
                                    </div>
                                    
                                    <div className="text-sm text-neutral-400">
                                        Expires: {new Date(voucher.expirationDate).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-neutral-500">
                                        Created by: {voucher.createdBy?.name}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteVoucher(voucher.id)}
                                    className="p-2 text-red-400 hover:text-red-300"
                                >
                                    <FaTrashAlt />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </RouteGuard>
    );
}