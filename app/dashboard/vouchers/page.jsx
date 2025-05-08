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
    const [voucherName, setVoucherName] = useState('');
    const [voucherType, setVoucherType] = useState('discount');
    const [discountType, setDiscountType] = useState('percentage');
    const [discountValue, setDiscountValue] = useState('');
    const [freeItem, setFreeItem] = useState('');
    const [freeItemType, setFreeItemType] = useState('product');
    const [productCategories, setProductCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [expireAfterRedemption, setExpireAfterRedemption] = useState(true);
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

    // Fetch product categories and products
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'categories'));
                const categoriesData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setProductCategories(categoriesData);
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        };

        const fetchProducts = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'products'));
                const productsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setProducts(productsData);
            } catch (error) {
                console.error('Error fetching products:', error);
            }
        };

        fetchCategories();
        fetchProducts();
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

        if (!voucherName) {
            setError('Please enter a voucher name');
            setLoading(false);
            return;
        }

        // Validate discount value if it's a discount voucher
        if (voucherType === 'discount' && (!discountValue || isNaN(discountValue) || parseFloat(discountValue) <= 0)) {
            setError('Please enter a valid discount value');
            setLoading(false);
            return;
        }

        // Validate percentage discount range (0-100)
        if (voucherType === 'discount' && discountType === 'percentage' && 
            (parseFloat(discountValue) < 0 || parseFloat(discountValue) > 100)) {
            setError('Percentage discount must be between 0 and 100');
            setLoading(false);
            return;
        }

        // Validate free item if it's a free item voucher
        if (voucherType === 'freeItem') {
            if (freeItemType === 'product' && !selectedProduct) {
                setError('Please select a product');
                setLoading(false);
                return;
            } else if (freeItemType === 'category' && !selectedCategory) {
                setError('Please select a category');
                setLoading(false);
                return;
            } else if (freeItemType === 'custom' && !freeItem) {
                setError('Please specify the free item');
                setLoading(false);
                return;
            }
        }

        try {
            const voucherCode = generateVoucherCode();
            const voucherData = {
                code: voucherCode,
                name: voucherName,
                voucherType: voucherType,
                expirationDate: new Date(expirationDate).toISOString(),
                createdAt: new Date().toISOString(),
                createdBy: {
                    id: staffAuth.staffId,
                    name: staffAuth.staffName,
                    role: staffAuth.accountType
                },
                expireAfterRedemption: expireAfterRedemption,
                active: true,
                redeemed: false,
                redemptionCount: 0
            };

            // Add specific fields based on voucher type
            if (voucherType === 'discount') {
                voucherData.discountType = discountType;
                voucherData.discountValue = parseFloat(discountValue);
            } else if (voucherType === 'freeItem') {
                voucherData.freeItemType = freeItemType;
                
                if (freeItemType === 'product') {
                    const selectedProductData = products.find(p => p.id === selectedProduct);
                    voucherData.freeItem = {
                        id: selectedProduct,
                        name: selectedProductData?.name || 'Unknown Product',
                        type: 'product'
                    };
                } else if (freeItemType === 'category') {
                    const selectedCategoryData = productCategories.find(c => c.id === selectedCategory);
                    voucherData.freeItem = {
                        id: selectedCategory,
                        name: selectedCategoryData?.name || 'Unknown Category',
                        type: 'category'
                    };
                } else {
                    voucherData.freeItem = {
                        name: freeItem,
                        type: 'custom'
                    };
                }
            }

            await addDoc(collection(db, 'vouchers'), voucherData);
            setVouchers([...vouchers, { ...voucherData }]);
            setSuccess('Voucher created successfully');
            
            // Reset form fields
            setVoucherName('');
            setVoucherType('discount');
            setDiscountType('percentage');
            setDiscountValue('');
            setFreeItem('');
            setFreeItemType('product');
            setSelectedCategory('');
            setSelectedProduct('');
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

    // Format voucher details for display
    const formatVoucherDetails = (voucher) => {
        if (voucher.voucherType === 'discount') {
            if (voucher.discountType === 'percentage') {
                return `${voucher.discountValue}% discount`;
            } else {
                return `R${voucher.discountValue.toFixed(2)} off`;
            }
        } else if (voucher.voucherType === 'freeItem') {
            if (typeof voucher.freeItem === 'object') {
                return `Free: ${voucher.freeItem.name}`;
            } else {
                return `Free: ${voucher.freeItem}`;
            }
        }
        return '';
    };

    return (
        <RouteGuard requiredRoles={['manager']}>
            <div className="min-h-screen bg-neutral-900 p-4">
                <div className="flex w-full gap-4 justify-between">
                    

                    {/* Create Voucher Form */}
                    <form onSubmit={handleCreateVoucher} className="mb-4 p-4 bg-neutral-800 rounded-lg w-1/2">
                        <h1 className="text-3xl font-bold text-white mb-4">Create Voucher</h1>
                        <div className="mb-4">
                            <label className="block text-white mb-2">Voucher Name</label>
                            <input
                                type="text"
                                value={voucherName}
                                onChange={(e) => setVoucherName(e.target.value)}
                                className="w-full p-2 bg-neutral-700 rounded text-white"
                                placeholder="e.g. Summer Special, New Customer"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-white mb-2">Voucher Type</label>
                            <select
                                value={voucherType}
                                onChange={(e) => setVoucherType(e.target.value)}
                                className="w-full p-2 bg-neutral-700 rounded text-white"
                                required
                            >
                                <option value="discount">Discount</option>
                                <option value="freeItem">Free Item</option>
                            </select>
                        </div>

                        {voucherType === 'discount' && (
                            <>
                                <div className="mb-4">
                                    <label className="block text-white mb-2">Discount Type</label>
                                    <select
                                        value={discountType}
                                        onChange={(e) => setDiscountType(e.target.value)}
                                        className="w-full p-2 bg-neutral-700 rounded text-white"
                                        required
                                    >
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed Amount (R)</option>
                                    </select>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-white mb-2">
                                        {discountType === 'percentage' ? 'Discount Percentage' : 'Discount Amount (R)'}
                                    </label>
                                    <input
                                        type="number"
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(e.target.value)}
                                        className="w-full p-2 bg-neutral-700 rounded text-white"
                                        placeholder={discountType === 'percentage' ? 'e.g. 10 for 10%' : 'e.g. 50 for R50 off'}
                                        step={discountType === 'percentage' ? '1' : '0.01'}
                                        min="0"
                                        max={discountType === 'percentage' ? '100' : ''}
                                        required
                                    />
                                </div>
                            </>
                        )}

                        {voucherType === 'freeItem' && (
                            <>
                                <div className="mb-4">
                                    <label className="block text-white mb-2">Free Item Type</label>
                                    <select
                                        value={freeItemType}
                                        onChange={(e) => setFreeItemType(e.target.value)}
                                        className="w-full p-2 bg-neutral-700 rounded text-white"
                                        required
                                    >
                                        <option value="product">Specific Product</option>
                                        <option value="category">Any Item from Category</option>
                                        <option value="custom">Custom Item (Text Description)</option>
                                    </select>
                                </div>

                                {freeItemType === 'product' && (
                                    <div className="mb-4">
                                        <label className="block text-white mb-2">Select Product</label>
                                        <select
                                            value={selectedProduct}
                                            onChange={(e) => setSelectedProduct(e.target.value)}
                                            className="w-full p-2 bg-neutral-700 rounded text-white"
                                            required
                                        >
                                            <option value="">Select a product</option>
                                            {products.map(product => (
                                                <option key={product.id} value={product.id}>
                                                    {product.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {freeItemType === 'category' && (
                                    <div className="mb-4">
                                        <label className="block text-white mb-2">Select Category</label>
                                        <select
                                            value={selectedCategory}
                                            onChange={(e) => setSelectedCategory(e.target.value)}
                                            className="w-full p-2 bg-neutral-700 rounded text-white"
                                            required
                                        >
                                            <option value="">Select a category</option>
                                            {productCategories.map(category => (
                                                <option key={category.id} value={category.id}>
                                                    {category.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {freeItemType === 'custom' && (
                                    <div className="mb-4">
                                        <label className="block text-white mb-2">Free Item Description</label>
                                        <input
                                            type="text"
                                            value={freeItem}
                                            onChange={(e) => setFreeItem(e.target.value)}
                                            className="w-full p-2 bg-neutral-700 rounded text-white"
                                            placeholder="e.g. Coffee, Croissant"
                                            required
                                        />
                                    </div>
                                )}
                            </>
                        )}

                        <div className="mb-4">
                            <label className="block text-white mb-2">Expiration Date</label>
                            <input
                                type="date"
                                value={expirationDate}
                                onChange={(e) => setExpirationDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full p-2 bg-neutral-700 rounded text-white"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="flex items-center text-white">
                                <input
                                    type="checkbox"
                                    checked={expireAfterRedemption}
                                    onChange={(e) => setExpireAfterRedemption(e.target.checked)}
                                    className="mr-2"
                                />
                                Expire after redemption
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Generate Voucher'}
                        </button>
                        <div className="mt-4">
                            {/* Messages */}
                            {error && <div className="mb-4 p-3 bg-red-600/20 border border-red-500 rounded">{error}</div>}
                            {success && <div className="mb-4 p-3 bg-green-600/20 border border-green-500 rounded">{success}</div>}
                        </div>

                    </form>


                    {/* Vouchers List */}
                    <div className="flex flex-col gap-4 w-1/2">
                        <h1 className="text-3xl font-bold text-white mb-4">Voucher List</h1>
                        {vouchers.map(voucher => (
                            <div key={voucher.code} className="p-4 bg-neutral-800 rounded-lg flex justify-between items-center">
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-xl flex gap-2 text-neutral-500 font-mono">
                                            {voucher.code}
                                            <button
                                                onClick={() => navigator.clipboard.writeText(voucher.code)}
                                                className="text-sm text-blue-400 hover:text-blue-300"
                                            >
                                                Copy                                            
                                            </button>
                                        </div>
                                        
                                        <div className={`px-2 py-1 rounded text-xs font-medium 
                                            ${voucher.redeemed 
                                                ? 'bg-red-900/30 text-red-400 border border-red-800' 
                                                : voucher.active 
                                                    ? 'bg-green-900/30 text-green-400 border border-green-800' 
                                                    : 'bg-neutral-700 text-neutral-400 border border-neutral-600'
                                            }`}>
                                            {voucher.redeemed ? 'Redeemed' : voucher.active ? 'Active' : 'Inactive'}
                                        </div>
                                    </div>
                                    
                                    <div className="text-sm text-white font-semibold">
                                        {voucher.name}
                                    </div>
                                    
                                    <div className="text-sm text-green-400">
                                        {formatVoucherDetails(voucher)}
                                    </div>
                                    
                                    <div className="text-sm text-neutral-400">
                                        Expires: {new Date(voucher.expirationDate).toLocaleDateString()}
                                        {voucher.expireAfterRedemption && ' (or after use)'}
                                    </div>
                                    
                                    <div className="text-xs text-neutral-500">
                                        Created by: {voucher.createdBy?.name}
                                    </div>
                                    
                                    {voucher.redeemed && (
                                        <div className="text-xs text-red-400 mt-1">
                                            Redeemed: {voucher.redeemedAt ? new Date(voucher.redeemedAt).toLocaleString() : 'Unknown date'}
                                            {voucher.redeemedBy?.staffName && ` by ${voucher.redeemedBy.staffName}`}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDeleteVoucher(voucher.id)}
                                    className="p-2 text-red-400 hover:text-red-300 ml-4"
                                >
                                    <FaTrashAlt />
                                </button>
                            </div>
                        ))}
                        {vouchers.length === 0 && (
                            <div className="text-center text-neutral-400 py-8">
                                No vouchers found. Create your first voucher!
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </RouteGuard>
    );
}