'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { FaTrashAlt, FaEdit, FaCheckCircle, FaExclamationCircle, FaGift, FaTag, FaCopy } from 'react-icons/fa';
import db from '../../../utils/firebase';
import RouteGuard from '../../components/RouteGuard';

// Reusable Toast Notification Component
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const isSuccess = type === 'success';
    const bgColor = isSuccess ? 'bg-green-600/30 border-green-500' : 'bg-red-600/30 border-red-500';
    const icon = isSuccess ? <FaCheckCircle className="text-green-400" /> : <FaExclamationCircle className="text-red-400" />;

    return (
        <div className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-lg flex items-center gap-3 text-white border ${bgColor} animate-fade-in-up z-50`}>
            {icon}
            <span>{message}</span>
        </div>
    );
};

export default function Vouchers() {
    const [vouchers, setVouchers] = useState([]);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [staffAuth, setStaffAuth] = useState(null);
    const initialVoucherState = {
        name: '', code: '', active: true, redeemed: false,
        voucherType: 'discount', // discount, freeItem, giftCard
        discountType: 'percentage', // percentage, fixed
        discountValue: '',
        initialValue: '', // for gift cards
        applicableItems: [], // for restricting discounts
        freeItem: { type: 'product', id: '', name: '' },
        maxRedemptions: 1, redemptionCount: 0,
        expirationDate: '',
    };
    const [newVoucher, setNewVoucher] = useState(initialVoucherState);
    const [editingId, setEditingId] = useState(null);
    const [notification, setNotification] = useState({ key: 0, message: '', type: '' });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const authData = localStorage.getItem('staffAuth');
        if (authData) setStaffAuth(JSON.parse(authData));

        const unsubVouchers = onSnapshot(query(collection(db, 'vouchers'), orderBy('createdAt', 'desc')), (snap) => {
            setVouchers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snap) => {
            setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const unsubCategories = onSnapshot(query(collection(db, 'categories'), orderBy('order')), (snap) => {
            setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => { unsubVouchers(); unsubProducts(); unsubCategories(); };
    }, []);

    const showNotification = (message, type) => {
        setNotification({ key: Date.now(), message, type });
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewVoucher(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleFreeItemChange = (e) => {
        const { name, value } = e.target;
        const selectedOption = e.target.options[e.target.selectedIndex];
        setNewVoucher(prev => ({
            ...prev,
            freeItem: { ...prev.freeItem, [name]: value, name: selectedOption.text }
        }));
    };

    const resetForm = () => {
        setNewVoucher(initialVoucherState);
        setEditingId(null);
    };

    const generateVoucherCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newVoucher.name || !newVoucher.expirationDate) {
            showNotification('Voucher Name and Expiration Date are required.', 'error');
            return;
        }
        setIsLoading(true);

        try {
            const voucherData = {
                ...newVoucher,
                code: newVoucher.code || generateVoucherCode(),
                expirationDate: Timestamp.fromDate(new Date(newVoucher.expirationDate)),
                discountValue: parseFloat(newVoucher.discountValue) || 0,
                initialValue: parseFloat(newVoucher.initialValue) || 0,
                currentBalance: parseFloat(newVoucher.initialValue) || 0,
                maxRedemptions: parseInt(newVoucher.maxRedemptions, 10) || 1,
                createdBy: { id: staffAuth.staffId, name: staffAuth.staffName, role: staffAuth.accountType },
                createdAt: Timestamp.now(),
            };

            // Clean up data based on type
            if (voucherData.voucherType !== 'discount') {
                delete voucherData.discountType;
                delete voucherData.discountValue;
            }
            if (voucherData.voucherType !== 'freeItem') {
                delete voucherData.freeItem;
            }
            if (voucherData.voucherType !== 'giftCard') {
                delete voucherData.initialValue;
                delete voucherData.currentBalance;
            }

            await addDoc(collection(db, 'vouchers'), voucherData);
            showNotification('Voucher created successfully!', 'success');
            resetForm();
        } catch (error) {
            showNotification('Failed to create voucher: ' + error.message, 'error');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (voucherId) => {
        if (!confirm('Are you sure you want to delete this voucher?')) return;
        try {
            await deleteDoc(doc(db, 'vouchers', voucherId));
            showNotification('Voucher deleted successfully.', 'success');
        } catch (error) {
            showNotification('Failed to delete voucher.', 'error');
            console.error(error);
        }
    };

    const formatVoucherDetails = (voucher) => {
        switch (voucher.voucherType) {
            case 'discount':
                return voucher.discountType === 'percentage'
                    ? `${voucher.discountValue}% off`
                    : `R ${voucher.discountValue?.toFixed(2)} off`;
            case 'freeItem':
                return `Free: ${voucher.freeItem?.name || 'Item'}`;
            case 'giftCard':
                return `Gift Card: R ${voucher.currentBalance?.toFixed(2)} / R ${voucher.initialValue?.toFixed(2)}`;
            default:
                return 'Standard Voucher';
        }
    };

    const copyToClipboard = (text) => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(() => showNotification('Voucher code copied!', 'success'))
                .catch(() => showNotification('Failed to copy code.', 'error'));
        } else {
            // Fallback for older browsers
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed'; // Prevent scrolling to bottom
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showNotification('Voucher code copied!', 'success');
            } catch {
                showNotification('Failed to copy code.', 'error');
            }
        }
    };

    const safeFormatDate = (dateVal) => {
        if (!dateVal) return 'N/A';
        if (typeof dateVal.toDate === 'function') {
            return dateVal.toDate().toLocaleDateString();
        }
        try {
            return new Date(dateVal).toLocaleDateString();
        } catch {
            return 'Invalid Date';
        }
    };

    return (
        <RouteGuard requiredRoles={['manager']}>
            <div className="min-h-screen bg-neutral-900 p-6 text-white">
                {notification.message && <Toast key={notification.key} message={notification.message} type={notification.type} onClose={() => setNotification({ message: '', type: '' })} />}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Column */}
                    <div className="lg:col-span-1">
                        <form onSubmit={handleSubmit} className="p-6 bg-neutral-800 rounded-lg border border-neutral-700 space-y-4">
                            <h2 className="text-xl font-bold">Create New Voucher</h2>
                            <input type="text" name="name" value={newVoucher.name} onChange={handleChange} placeholder="Voucher Name" className="w-full p-2 bg-neutral-700 rounded" required />
                            <select name="voucherType" value={newVoucher.voucherType} onChange={handleChange} className="w-full p-2 bg-neutral-700 rounded">
                                <option value="discount">Discount Voucher</option>
                                <option value="freeItem">Free Item Voucher</option>
                                <option value="giftCard">Gift Card</option>
                            </select>

                            {newVoucher.voucherType === 'discount' && (
                                <div className="p-3 bg-neutral-900/50 rounded-md space-y-3">
                                    <select name="discountType" value={newVoucher.discountType} onChange={handleChange} className="w-full p-2 bg-neutral-700 rounded">
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed Amount (R)</option>
                                    </select>
                                    <input type="number" name="discountValue" value={newVoucher.discountValue} onChange={handleChange} placeholder="Discount Value" className="w-full p-2 bg-neutral-700 rounded" step="0.01" min="0" />
                                </div>
                            )}

                            {newVoucher.voucherType === 'freeItem' && (
                                <div className="p-3 bg-neutral-900/50 rounded-md space-y-3">
                                    <select name="type" value={newVoucher.freeItem.type} onChange={(e) => setNewVoucher(p => ({ ...p, freeItem: { ...p.freeItem, type: e.target.value, id: '', name: '' } }))} className="w-full p-2 bg-neutral-700 rounded">
                                        <option value="product">Specific Product</option>
                                        <option value="category">Any Item from Category</option>
                                    </select>
                                    {newVoucher.freeItem.type === 'product' ? (
                                        <select name="id" value={newVoucher.freeItem.id} onChange={handleFreeItemChange} className="w-full p-2 bg-neutral-700 rounded">
                                            <option value="">Select Product...</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    ) : (
                                        <select name="id" value={newVoucher.freeItem.id} onChange={handleFreeItemChange} className="w-full p-2 bg-neutral-700 rounded">
                                            <option value="">Select Category...</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    )}
                                </div>
                            )}

                            {newVoucher.voucherType === 'giftCard' && (
                                <div className="p-3 bg-neutral-900/50 rounded-md">
                                    <input type="number" name="initialValue" value={newVoucher.initialValue} onChange={handleChange} placeholder="Initial Value (R)" className="w-full p-2 bg-neutral-700 rounded" step="0.01" min="0" />
                                </div>
                            )}

                            <input type="number" name="maxRedemptions" value={newVoucher.maxRedemptions} onChange={handleChange} placeholder="Max Redemptions" className="w-full p-2 bg-neutral-700 rounded" min="1" />
                            <input type="date" name="expirationDate" value={newVoucher.expirationDate} onChange={handleChange} min={new Date().toISOString().split('T')[0]} className="w-full p-2 bg-neutral-700 rounded" required />
                            
                            <button type="submit" disabled={isLoading} className="w-full p-3 bg-indigo-600 hover:bg-indigo-700 rounded disabled:bg-neutral-600 font-medium">
                                {isLoading ? 'Creating...' : 'Create Voucher'}
                            </button>
                        </form>
                    </div>

                    {/* List Column */}
                    <div className="lg:col-span-2 space-y-4">
                        {vouchers.map(voucher => (
                            <div key={voucher.id} className={`p-4 bg-neutral-800 rounded-lg border ${voucher.redeemed ? 'border-red-700/50' : 'border-neutral-700'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex-grow">
                                        <p className="font-bold text-white">{voucher.name}</p>
                                        <div className="flex items-center gap-3 my-1">
                                            <p className="font-mono text-lg text-amber-400">{voucher.code}</p>
                                            <button onClick={() => copyToClipboard(voucher.code)} className="text-blue-400 hover:text-blue-300"><FaCopy /></button>
                                        </div>
                                        <p className="text-sm text-indigo-300 font-medium">{formatVoucherDetails(voucher)}</p>
                                        <p className="text-xs text-neutral-400 mt-2">
                                            Expires: {safeFormatDate(voucher.expirationDate)}
                                        </p>
                                        <p className="text-xs text-neutral-500">Redemptions: {voucher.redemptionCount} / {voucher.maxRedemptions}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${voucher.redeemed ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                                            {voucher.redeemed ? 'Redeemed' : 'Active'}
                                        </span>
                                        <button onClick={() => handleDelete(voucher.id)} className="text-red-500 hover:text-red-400"><FaTrashAlt /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {vouchers.length === 0 && <p className="text-center text-neutral-500 py-8">No vouchers created yet.</p>}
                    </div>
                </div>
            </div>
        </RouteGuard>
    );
}