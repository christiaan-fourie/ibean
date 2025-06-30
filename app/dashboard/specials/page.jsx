'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { FaEdit, FaTrashAlt, FaCalendarAlt, FaTag, FaStar, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
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

export default function Specials() {
    const [specials, setSpecials] = useState([]);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [staffAuth, setStaffAuth] = useState(null);
    const initialSpecialState = {
        name: '', description: '', active: true, mutuallyExclusive: false,
        triggerType: 'product', triggerProduct: '', triggerProductSize: '', triggerCategory: '', triggerCategorySize: '', triggerQuantity: 1,
        rewardType: 'product', rewardProduct: '', rewardProductSize: '', rewardCategory: '', rewardCategorySize: '', rewardQuantity: 1,
        discountType: 'free', discountValue: 100, fixedDiscountAmount: 0,
        startDate: '', endDate: '',
    };
    const [newSpecial, setNewSpecial] = useState(initialSpecialState);
    const [editingId, setEditingId] = useState(null);
    const [notification, setNotification] = useState({ key: 0, message: '', type: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('all');

    // Real-time data fetching
    useEffect(() => {
        const authData = localStorage.getItem('staffAuth');
        if (authData) setStaffAuth(JSON.parse(authData));

        const unsubSpecials = onSnapshot(query(collection(db, 'specials'), orderBy('name')), (snapshot) => {
            setSpecials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snapshot) => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const unsubCategories = onSnapshot(query(collection(db, 'categories'), orderBy('order')), (snapshot) => {
            setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubSpecials();
            unsubProducts();
            unsubCategories();
        };
    }, []);

    const showNotification = (message, type) => {
        setNotification({ key: Date.now(), message, type });
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewSpecial(prev => {
            const updated = { ...prev, [name]: type === 'checkbox' ? checked : value };
            // Reset dependent fields for data integrity
            if (name === 'triggerType') {
                updated.triggerProduct = ''; updated.triggerProductSize = ''; updated.triggerCategory = ''; updated.triggerCategorySize = '';
            }
            if (name === 'rewardType') {
                updated.rewardProduct = ''; updated.rewardProductSize = ''; updated.rewardCategory = ''; updated.rewardCategorySize = '';
            }
            if (name === 'triggerProduct' || name === 'triggerCategory') {
                updated.triggerProductSize = ''; updated.triggerCategorySize = '';
            }
            if (name === 'rewardProduct' || name === 'rewardCategory') {
                updated.rewardProductSize = ''; updated.rewardCategorySize = '';
            }
            return updated;
        });
    };

    const resetForm = () => {
        setNewSpecial(initialSpecialState);
        setEditingId(null);
    };

    const handleStartEdit = (special) => {
        setEditingId(special.id);
        setNewSpecial({ ...initialSpecialState, ...special });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (specialId) => {
        if (!confirm('Are you sure you want to delete this special?')) return;
        try {
            await deleteDoc(doc(db, 'specials', specialId));
            showNotification('Special deleted successfully', 'success');
        } catch (error) {
            showNotification('Failed to delete special', 'error');
            console.error('Error deleting special:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newSpecial.name) {
            showNotification('Special name is required.', 'error');
            return;
        }
        setIsLoading(true);

        try {
            const specialData = {
                ...newSpecial,
                triggerQuantity: parseInt(newSpecial.triggerQuantity, 10) || 1,
                rewardQuantity: parseInt(newSpecial.rewardQuantity, 10) || 1,
            };

            if (newSpecial.discountType === 'free') {
                specialData.discountValue = 100;
                specialData.fixedDiscountAmount = 0;
            } else if (newSpecial.discountType === 'percentage') {
                specialData.discountValue = parseInt(newSpecial.discountValue, 10) || 0;
                specialData.fixedDiscountAmount = 0;
            } else if (newSpecial.discountType === 'fixed') {
                specialData.discountValue = 0;
                specialData.fixedDiscountAmount = parseFloat(newSpecial.fixedDiscountAmount) || 0;
            }

            if (editingId) {
                await updateDoc(doc(db, 'specials', editingId), specialData);
                showNotification('Special updated successfully', 'success');
            } else {
                await addDoc(collection(db, 'specials'), specialData);
                showNotification('Special added successfully', 'success');
            }
            resetForm();
        } catch (error) {
            showNotification('Failed to save special: ' + error.message, 'error');
            console.error('Error saving special:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getVarietiesForCategory = (categoryName) => {
        const category = categories.find(c => c.name === categoryName);
        return category?.varieties || [];
    };

    const filteredSpecials = specials.filter(s => {
        if (activeTab === 'all') return true;
        if (activeTab === 'exclusive') return s.mutuallyExclusive;
        if (activeTab === 'stackable') return !s.mutuallyExclusive;
        return true;
    });

    const renderSizeDropdown = (field, value, onChange) => {
        let categoryName = '';
        if (field === 'triggerProduct' || field === 'rewardProduct') {
            const product = products.find(p => p.id === newSpecial[field]);
            categoryName = product?.category;
        } else if (field === 'triggerCategory' || field === 'rewardCategory') {
            categoryName = newSpecial[field];
        }
        const varieties = getVarietiesForCategory(categoryName);
        if (varieties.length === 0) return null;

        return (
            <select name={`${field}Size`} value={value} onChange={onChange} className="p-2 bg-neutral-700 rounded w-full">
                <option value="">Any Size</option>
                {varieties.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
        );
    };

    return (
        <RouteGuard requiredRoles={['manager']}>
            <div className="flex flex-col min-h-screen p-6 bg-neutral-900 text-neutral-50">
                {notification.message && <Toast key={notification.key} message={notification.message} type={notification.type} onClose={() => setNotification({ message: '', type: '' })} />}
                <h1 className="text-3xl font-bold mb-6">Specials Management</h1>

                <form onSubmit={handleSubmit} className="mb-8 p-6 bg-neutral-800 rounded-lg shadow-md space-y-6">
                    <div>
                        <input type="text" name="name" value={newSpecial.name} onChange={handleChange} placeholder="Special Name" className="w-full p-2 bg-neutral-700 rounded" required />
                        <input type="text" name="description" value={newSpecial.description} onChange={handleChange} placeholder="Description" className="mt-2 w-full p-2 bg-neutral-700 rounded" />
                    </div>

                    <div className='flex flex-col lg:flex-row justify-between items-start gap-6'>
                        {/* Trigger Section */}
                        <div className="w-full lg:w-1/2 border border-neutral-700 p-4 rounded-md space-y-3">
                            <h3 className="text-lg font-semibold text-indigo-400">Trigger Conditions</h3>
                            <select name="triggerType" value={newSpecial.triggerType} onChange={handleChange} className="p-2 bg-neutral-700 rounded w-full">
                                <option value="product">Specific Product</option>
                                <option value="category">Any Product in Category</option>
                            </select>
                            {newSpecial.triggerType === 'product' ? (
                                <select name="triggerProduct" value={newSpecial.triggerProduct} onChange={handleChange} className="p-2 bg-neutral-700 rounded w-full">
                                    <option value="">Select Product...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            ) : (
                                <select name="triggerCategory" value={newSpecial.triggerCategory} onChange={handleChange} className="p-2 bg-neutral-700 rounded w-full">
                                    <option value="">Select Category...</option>
                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            )}
                            {newSpecial.triggerType === 'product'
  ? renderSizeDropdown('triggerProduct', newSpecial.triggerProductSize, handleChange)
  : renderSizeDropdown('triggerCategory', newSpecial.triggerCategorySize, handleChange)
}
                            <input type="number" name="triggerQuantity" value={newSpecial.triggerQuantity} onChange={handleChange} placeholder="Quantity needed" min="1" className="p-2 bg-neutral-700 rounded w-full" required />
                        </div>

                        {/* Reward Section */}
                        <div className="w-full lg:w-1/2 border border-neutral-700 p-4 rounded-md space-y-3">
                            <h3 className="text-lg font-semibold text-green-400">Reward Conditions</h3>
                            <select name="rewardType" value={newSpecial.rewardType} onChange={handleChange} className="p-2 bg-neutral-700 rounded w-full">
                                <option value="product">Specific Product</option>
                                <option value="category">Any Product in Category</option>
                            </select>
                            {newSpecial.rewardType === 'product' ? (
                                <select name="rewardProduct" value={newSpecial.rewardProduct} onChange={handleChange} className="p-2 bg-neutral-700 rounded w-full">
                                    <option value="">Select Product...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            ) : (
                                <select name="rewardCategory" value={newSpecial.rewardCategory} onChange={handleChange} className="p-2 bg-neutral-700 rounded w-full">
                                    <option value="">Select Category...</option>
                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            )}
                            {newSpecial.rewardType === 'product'
      ? renderSizeDropdown('rewardProduct', newSpecial.rewardProductSize, handleChange)
      : renderSizeDropdown('rewardCategory', newSpecial.rewardCategorySize, handleChange)
    }
                            <input type="number" name="rewardQuantity" value={newSpecial.rewardQuantity} onChange={handleChange} placeholder="Reward quantity" min="1" className="p-2 bg-neutral-700 rounded w-full" required />
                        </div>
                    </div>

                    <div className="border border-neutral-700 p-4 rounded-md space-y-3">
                        <h3 className="text-lg font-semibold text-amber-400">Discount Settings</h3>
                        <select name="discountType" value={newSpecial.discountType} onChange={handleChange} className="p-2 bg-neutral-700 rounded w-full">
                            <option value="free">Free</option>
                            <option value="percentage">Percentage Discount</option>
                            <option value="fixed">Fixed Amount Discount</option>
                        </select>
                        {newSpecial.discountType === 'percentage' && <input type="number" name="discountValue" value={newSpecial.discountValue} onChange={handleChange} placeholder="Discount %" min="1" max="100" className="p-2 bg-neutral-700 rounded w-full" />}
                        {newSpecial.discountType === 'fixed' && <input type="number" name="fixedDiscountAmount" value={newSpecial.fixedDiscountAmount} onChange={handleChange} placeholder="Discount amount (R)" min="0.01" step="0.01" className="p-2 bg-neutral-700 rounded w-full" />}
                    </div>

                    <div className="border border-neutral-700 p-4 rounded-md">
                        <h3 className="text-lg font-semibold mb-2 text-blue-400">Validity Period (Optional)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input type="date" name="startDate" value={newSpecial.startDate} onChange={handleChange} className="p-2 bg-neutral-700 rounded w-full" />
                            <input type="date" name="endDate" value={newSpecial.endDate} onChange={handleChange} className="p-2 bg-neutral-700 rounded w-full" />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 rounded-md bg-neutral-700/50">
                        <input type="checkbox" id="mutuallyExclusive" name="mutuallyExclusive" checked={newSpecial.mutuallyExclusive} onChange={handleChange} className="w-5 h-5 text-yellow-600 bg-gray-100 rounded border-gray-300 focus:ring-yellow-500" />
                        <label htmlFor="mutuallyExclusive" className="font-medium text-yellow-400">Mutually Exclusive <span className="text-sm text-neutral-400">(Cannot stack with other specials)</span></label>
                    </div>

                    <div className="flex gap-4">
                        <button type="submit" disabled={isLoading} className="w-full p-3 bg-indigo-600 hover:bg-indigo-700 rounded disabled:bg-neutral-600 font-medium">
                            {isLoading ? 'Saving...' : (editingId ? 'Update Special' : 'Add Special')}
                        </button>
                        {editingId && <button type="button" onClick={resetForm} className="p-3 bg-neutral-600 hover:bg-neutral-500 rounded">Cancel</button>}
                    </div>
                </form>

                <div className="mb-6 flex gap-4 border-b border-neutral-700 pb-2">
                    <button className={`py-2 px-4 ${activeTab === 'all' ? 'border-b-2 border-indigo-500 text-white' : 'text-neutral-400'}`} onClick={() => setActiveTab('all')}>All</button>
                    <button className={`py-2 px-4 flex items-center gap-2 ${activeTab === 'exclusive' ? 'border-b-2 border-yellow-500 text-white' : 'text-neutral-400'}`} onClick={() => setActiveTab('exclusive')}><FaStar /> Exclusive</button>
                    <button className={`py-2 px-4 ${activeTab === 'stackable' ? 'border-b-2 border-green-500 text-white' : 'text-neutral-400'}`} onClick={() => setActiveTab('stackable')}>Stackable</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredSpecials.map(special => (
                        <div key={special.id} className={`p-5 bg-neutral-800 rounded-lg shadow-md border ${special.mutuallyExclusive ? 'border-yellow-700' : 'border-neutral-700'}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex-grow pr-4">
                                    <h3 className="text-xl font-bold text-white">{special.name}</h3>
                                    <p className="text-neutral-400 mt-1 text-sm">{special.description}</p>
                                    <div className="mt-3 space-y-2 text-sm">
                                        <p><span className="font-semibold text-indigo-300">Buy:</span> {special.triggerQuantity} &times; {special.triggerType === 'product' ? (products.find(p => p.id === special.triggerProduct)?.name || 'N/A') : special.triggerCategory} {special.triggerProductSize || special.triggerCategorySize}</p>
                                        <p><span className="font-semibold text-green-300">Get:</span> {special.rewardQuantity} &times; {special.rewardType === 'product' ? (products.find(p => p.id === special.rewardProduct)?.name || 'N/A') : special.rewardCategory} {special.rewardProductSize || special.rewardCategorySize} <span className="font-bold text-amber-300">{special.discountType === 'free' ? 'FREE' : special.discountType === 'percentage' ? `${special.discountValue}% off` : `R${special.fixedDiscountAmount?.toFixed(2)} off`}</span></p>
                                        {special.startDate && <p className="text-neutral-500"><FaCalendarAlt className="inline mr-2" />{special.startDate} to {special.endDate}</p>}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 flex-shrink-0">
                                    <button onClick={() => handleStartEdit(special)} className="text-blue-400 hover:text-blue-300"><FaEdit /></button>
                                    <button onClick={() => handleDelete(special.id)} className="text-red-400 hover:text-red-300"><FaTrashAlt /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </RouteGuard>
    );
}
