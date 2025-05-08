'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { FaEdit, FaTrashAlt, FaCalendarAlt, FaTag, FaStar } from 'react-icons/fa';
import db from '../../../utils/firebase';
import RouteGuard from '../../components/RouteGuard';

export default function Specials() {
    const [specials, setSpecials] = useState([]);
    const [products, setProducts] = useState([]);
    const [newSpecial, setNewSpecial] = useState({
        name: '',
        description: '',
        triggerType: 'product', // 'product' or 'category'
        triggerProduct: '', // Product that needs to be bought
        triggerProductSize: '', // Added for coffee size selection
        triggerCategory: '', // Category that needs to be bought
        triggerCategorySize: '', // Size for category-based trigger
        triggerQuantity: 1, // Quantity needed to trigger special
        rewardType: 'product', // 'product' or 'category'
        rewardProduct: '', // Product that will be free/discounted
        rewardProductSize: '', // Added for coffee size selection
        rewardCategory: '', // Category for reward
        rewardCategorySize: '', // Size for category-based reward
        rewardQuantity: 1, // Quantity of products to reward
        discountType: 'free', // 'free' or 'percentage'
        discountValue: 100, // 100 for free, or percentage value
        active: true,
        startDate: '',
        endDate: '',
        mutuallyExclusive: false,
    });
    const [editingId, setEditingId] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'exclusive', 'stackable'

    // Fetch specials and products on component mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [specialsSnapshot, productsSnapshot] = await Promise.all([
                    getDocs(collection(db, 'specials')),
                    getDocs(collection(db, 'products'))
                ]);

                const specialsData = specialsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setSpecials(specialsData);

                const productsData = productsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setProducts(productsData);
            } catch (error) {
                setErrorMessage('Failed to fetch data');
                console.error('Error fetching data:', error);
            }
        };
        fetchData();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewSpecial(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const resetForm = () => {
        setNewSpecial({
            name: '',
            description: '',
            triggerType: 'product', 
            triggerProduct: '',
            triggerProductSize: '',
            triggerCategory: '',
            triggerCategorySize: '',
            triggerQuantity: 1, 
            rewardType: 'product', 
            rewardProduct: '',
            rewardProductSize: '',
            rewardCategory: '',
            rewardCategorySize: '',
            rewardQuantity: 1, 
            discountType: 'free', 
            discountValue: 100, 
            active: true,
            startDate: '',
            endDate: '',
            mutuallyExclusive: false,
        });
        setEditingId(null);
    };

    const handleDelete = async (specialId) => {
        if (!confirm('Are you sure you want to delete this special?')) return;
        
        try {
            await deleteDoc(doc(db, 'specials', specialId));
            setSpecials(specials.filter(s => s.id !== specialId));
            setSuccessMessage('Special deleted successfully');
        } catch (error) {
            setErrorMessage('Failed to delete special');
            console.error('Error deleting special:', error);
        }
    };

    const handleStartEdit = (special) => {
        setEditingId(special.id);
        setNewSpecial({
            name: special.name,
            description: special.description,
            triggerType: special.triggerType || 'product', 
            triggerProduct: special.triggerProduct || '',
            triggerProductSize: special.triggerProductSize || '',
            triggerCategory: special.triggerCategory || '',
            triggerCategorySize: special.triggerCategorySize || '',
            triggerQuantity: special.triggerQuantity,
            rewardType: special.rewardType || 'product', 
            rewardProduct: special.rewardProduct || '',
            rewardProductSize: special.rewardProductSize || '',
            rewardCategory: special.rewardCategory || '',
            rewardCategorySize: special.rewardCategorySize || '',
            rewardQuantity: special.rewardQuantity,
            discountType: special.discountType,
            discountValue: special.discountValue,
            active: special.active,
            startDate: special.startDate || '',
            endDate: special.endDate || '',
            mutuallyExclusive: special.mutuallyExclusive || false,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSuccessMessage('');
        setErrorMessage('');

        // Validate required fields
        if (!newSpecial.name.trim()) {
            setErrorMessage('Please enter a special name');
            return;
        }

        // Validate trigger conditions
        if (!newSpecial.triggerType) {
            setErrorMessage('Please select a trigger type');
            return;
        }
        if (newSpecial.triggerType === 'product' && !newSpecial.triggerProduct) {
            setErrorMessage('Please select a trigger product');
            return;
        }
        if (newSpecial.triggerType === 'category' && !newSpecial.triggerCategory) {
            setErrorMessage('Please select a trigger category');
            return;
        }
        if (newSpecial.triggerType === 'product' && newSpecial.triggerProductSize && !newSpecial.triggerProductSize.trim()) {
            setErrorMessage('Please select a trigger product size');
            return;
        }
        if (newSpecial.triggerType === 'category' && newSpecial.triggerCategorySize && !newSpecial.triggerCategorySize.trim()) {
            setErrorMessage('Please select a trigger category size');
            return;
        }
        if (!newSpecial.triggerQuantity || newSpecial.triggerQuantity < 1) {
            setErrorMessage('Please enter a valid trigger quantity');
            return;
        }

        // Validate reward conditions
        if (!newSpecial.rewardType) {
            setErrorMessage('Please select a reward type');
            return;
        }
        if (newSpecial.rewardType === 'product' && !newSpecial.rewardProduct) {
            setErrorMessage('Please select a reward product');
            return;
        }
        if (newSpecial.rewardType === 'category' && !newSpecial.rewardCategory) {
            setErrorMessage('Please select a reward category');
            return;
        }
        if (newSpecial.rewardType === 'product' && newSpecial.rewardProductSize && !newSpecial.rewardProductSize.trim()) {
            setErrorMessage('Please select a reward product size');
            return;
        }
        if (newSpecial.rewardType === 'category' && newSpecial.rewardCategorySize && !newSpecial.rewardCategorySize.trim()) {
            setErrorMessage('Please select a reward category size');
            return;
        }
        if (!newSpecial.rewardQuantity || newSpecial.rewardQuantity < 1) {
            setErrorMessage('Please enter a valid reward quantity');
            return;
        }

        if (newSpecial.discountType === 'percentage' && (!newSpecial.discountValue || newSpecial.discountValue < 1 || newSpecial.discountValue > 100)) {
            setErrorMessage('Please enter a valid discount percentage (1-100)');
            return;
        }

        try {
            const specialData = {
                ...newSpecial,
                triggerQuantity: parseInt(newSpecial.triggerQuantity),
                rewardQuantity: parseInt(newSpecial.rewardQuantity),
                discountValue: parseInt(newSpecial.discountValue),
                mutuallyExclusive: newSpecial.mutuallyExclusive || false,
            };

            if (editingId) {
                await updateDoc(doc(db, 'specials', editingId), specialData);
                setSpecials(specials.map(s => 
                    s.id === editingId ? { ...specialData, id: editingId } : s
                ));
                setSuccessMessage('Special updated successfully');
            } else {
                const docRef = await addDoc(collection(db, 'specials'), specialData);
                setSpecials([...specials, { ...specialData, id: docRef.id }]);
                setSuccessMessage('Special added successfully');
            }
            resetForm();
        } catch (error) {
            setErrorMessage('Failed to save special');
            console.error('Error saving special:', error);
        }
    };

    const handleTabChange = (tab) => {
        setNewSpecial(prev => ({
            ...prev,
            triggerType: tab,
            rewardType: tab,
            triggerProduct: '',
            triggerProductSize: '',
            triggerCategory: '',
            triggerCategorySize: '',
            rewardProduct: '',
            rewardProductSize: '',
            rewardCategory: '',
            rewardCategorySize: '',
        }));
    };

    const isCoffeeProduct = (productId) => {
        const product = products.find(p => p.id === productId);
        return product?.category === 'coffee';
    };
    
    // Format category name for display
    const formatCategoryName = (category) => {
        if (!category) return '';
        return category.charAt(0).toUpperCase() + category.slice(1);
    };
    
    // Filter specials based on active tab
    const filteredSpecials = () => {
        if (activeTab === 'all') return specials;
        if (activeTab === 'exclusive') return specials.filter(s => s.mutuallyExclusive);
        if (activeTab === 'stackable') return specials.filter(s => !s.mutuallyExclusive);
        return specials;
    };

    return (
        <RouteGuard requiredRoles={['manager']}>
            <div className="flex flex-col min-h-screen p-6 bg-neutral-900 text-neutral-50">
                <h1 className="text-3xl font-bold mb-6">Specials Management</h1>

                {/* Form Section */}
                <form onSubmit={handleSubmit} className="mb-8 p-6 bg-neutral-800 rounded-lg shadow-md">
                    <div className="grid grid-cols-1 gap-4 mb-4">
                        <input
                            type="text"
                            name="name"
                            value={newSpecial.name}
                            onChange={handleChange}
                            placeholder="Special Name"
                            className="p-2 bg-neutral-700 rounded"
                            required
                        />
                        <input
                            type="text"
                            name="description"
                            value={newSpecial.description}
                            onChange={handleChange}
                            placeholder="Description"
                            className="p-2 bg-neutral-700 rounded"
                        />
                    </div>

                    <div className='flex justify-between items-start gap-4'>
                    {/* Trigger Section */}
                    <div className="mb-4 w-1/2 border border-neutral-700 p-4 rounded-md">
                            <h3 className="text-lg font-semibold mb-4 text-indigo-400">Trigger Conditions</h3>
                            <div className="flex flex-col gap-4">
                                <select
                                    name="triggerType"
                                    value={newSpecial.triggerType}
                                    onChange={handleChange}
                                    className="p-2 bg-neutral-700 rounded w-full md:w-1/2"
                                >
                                    <option value="product">Specific Product</option>
                                    <option value="category">Category</option>
                                </select>

                                {newSpecial.triggerType === 'product' && (
                                    <select
                                        name="triggerProduct"
                                        value={newSpecial.triggerProduct}
                                        onChange={handleChange}
                                        className="p-2 bg-neutral-700 rounded w-full md:w-1/2"
                                    >
                                        <option value="">Select Product</option>
                                        {products.map(product => (
                                            <option key={product.id} value={product.id}>
                                                {product.name}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {newSpecial.triggerType === 'category' && (
                                    <select
                                        name="triggerCategory"
                                        value={newSpecial.triggerCategory}
                                        onChange={handleChange}
                                        className="p-2 bg-neutral-700 rounded w-full md:w-1/2"
                                    >
                                        <option value="">Select Category</option>
                                        {products
                                            .map(p => p.category)
                                            .filter((value, index, self) => self.indexOf(value) === index)
                                            .map(category => (
                                                <option key={category} value={category}>
                                                    {formatCategoryName(category)}
                                                </option>
                                            ))}
                                    </select>
                                )}

                                {newSpecial.triggerType === 'product' && isCoffeeProduct(newSpecial.triggerProduct) && (
                                    <select
                                        name="triggerProductSize"
                                        value={newSpecial.triggerProductSize}
                                        onChange={handleChange}
                                        className="p-2 bg-neutral-700 rounded w-full md:w-1/2"
                                    >
                                        <option value="">Select Size</option>
                                        {['Solo', 'Short', 'Tall', 'Black'].map(size => (
                                            <option key={size} value={size}>
                                                {size}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {newSpecial.triggerType === 'category' && newSpecial.triggerCategory?.toLowerCase() === 'coffee' && (
                                    <select
                                        name="triggerCategorySize"
                                        value={newSpecial.triggerCategorySize}
                                        onChange={handleChange}
                                        className="p-2 bg-neutral-700 rounded w-full md:w-1/2"
                                    >
                                        <option value="">Select Size</option>
                                        {['Solo', 'Short', 'Tall', 'Black'].map(size => (
                                            <option key={size} value={size}>
                                                {size}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                <input
                                    type="number"
                                    name="triggerQuantity"
                                    value={newSpecial.triggerQuantity}
                                    onChange={handleChange}
                                    placeholder="Quantity needed"
                                    min="1"
                                    className="p-2 bg-neutral-700 rounded w-full md:w-1/2"
                                    required
                                />
                            </div>
                        </div>

                        {/* Reward Section */}
                        <div className="w-1/2 border border-neutral-700 p-4 rounded-md">
                            <h3 className="text-lg font-semibold mb-4 text-green-400">Reward Conditions</h3>
                            <div className="flex flex-col gap-4">
                                <select
                                    name="rewardType"
                                    value={newSpecial.rewardType}
                                    onChange={handleChange}
                                    className="p-2 bg-neutral-700 rounded w-full md:w-1/2"
                                >
                                    <option value="product">Specific Product</option>
                                    <option value="category">Category</option>
                                </select>

                                {newSpecial.rewardType === 'product' && (
                                    <select
                                        name="rewardProduct"
                                        value={newSpecial.rewardProduct}
                                        onChange={handleChange}
                                        className="p-2 bg-neutral-700 rounded w-full md:w-1/2"
                                    >
                                        <option value="">Select Product</option>
                                        {products.map(product => (
                                            <option key={product.id} value={product.id}>
                                                {product.name}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {newSpecial.rewardType === 'category' && (
                                    <select
                                        name="rewardCategory"
                                        value={newSpecial.rewardCategory}
                                        onChange={handleChange}
                                        className="p-2 bg-neutral-700 rounded w-full md:w-1/2"
                                    >
                                        <option value="">Select Category</option>
                                        {products
                                            .map(p => p.category)
                                            .filter((value, index, self) => self.indexOf(value) === index)
                                            .map(category => (
                                                <option key={category} value={category}>
                                                    {formatCategoryName(category)}
                                                </option>
                                            ))}
                                    </select>
                                )}

                                {newSpecial.rewardType === 'product' && isCoffeeProduct(newSpecial.rewardProduct) && (
                                    <select
                                        name="rewardProductSize"
                                        value={newSpecial.rewardProductSize}
                                        onChange={handleChange}
                                        className="p-2 bg-neutral-700 rounded w-full md:w-1/2"
                                    >
                                        <option value="">Select Size</option>
                                        {['Solo', 'Short', 'Tall', 'Black'].map(size => (
                                            <option key={size} value={size}>
                                                {size}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {newSpecial.rewardType === 'category' && newSpecial.rewardCategory?.toLowerCase() === 'coffee' && (
                                    <select
                                        name="rewardCategorySize"
                                        value={newSpecial.rewardCategorySize}
                                        onChange={handleChange}
                                        className="p-2 bg-neutral-700 rounded w-full md:w-1/2"
                                    >
                                        <option value="">Select Size</option>
                                        {['Solo', 'Short', 'Tall', 'Black'].map(size => (
                                            <option key={size} value={size}>
                                                {size}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                <input
                                    type="number"
                                    name="rewardQuantity"
                                    value={newSpecial.rewardQuantity}
                                    onChange={handleChange}
                                    placeholder="Reward quantity"
                                    min="1"
                                    className="p-2 bg-neutral-700 rounded w-full md:w-1/2"
                                    required
                                />
                            </div>
                        </div>

                    </div>

                    

                    <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-4 text-amber-400">Discount Settings</h3>
                        <div className="flex gap-4">
                            <select
                                name="discountType"
                                value={newSpecial.discountType}
                                onChange={handleChange}
                                className="p-2 bg-neutral-700 rounded w-full md:w-1/2"
                            >
                                <option value="free">Free</option>
                                <option value="percentage">Percentage Discount</option>
                            </select>

                            {newSpecial.discountType === 'percentage' && (
                                <input
                                    type="number"
                                    name="discountValue"
                                    value={newSpecial.discountValue}
                                    onChange={handleChange}
                                    placeholder="Discount percentage"
                                    min="1"
                                    max="100"
                                    className="p-2 bg-neutral-700 rounded w-full md:w-1/2"
                                />
                            )}
                        </div>
                        
                    </div>

                    <div className="mt-6 mb-4">
                        <h3 className="text-lg font-semibold mb-4 text-blue-400">Validity Period</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-neutral-400 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    name="startDate"
                                    value={newSpecial.startDate}
                                    onChange={handleChange}
                                    className="p-2 bg-neutral-700 rounded w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-neutral-400 mb-1">End Date</label>
                                <input
                                    type="date"
                                    name="endDate"
                                    value={newSpecial.endDate}
                                    onChange={handleChange}
                                    className="p-2 bg-neutral-700 rounded w-full"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 mb-6 border border-yellow-900 bg-yellow-950/30 p-4 rounded-md">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="mutuallyExclusive"
                                name="mutuallyExclusive"
                                checked={newSpecial.mutuallyExclusive || false}
                                onChange={handleChange}
                                className="w-5 h-5 text-yellow-600 bg-gray-100 rounded border-gray-300 focus:ring-yellow-500"
                            />
                            <label htmlFor="mutuallyExclusive" className="text-yellow-400 font-medium">
                                Mutually Exclusive <span className="text-sm">(Cannot stack with other specials)</span>
                            </label>
                        </div>
                        <p className="mt-2 text-sm text-neutral-400 ml-8">When enabled, this special cannot be combined with other specials during checkout</p>
                    </div>

                    <button
                        type="submit"
                        className="w-full p-3 mt-4 bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors font-medium text-lg"
                    >
                        {editingId ? 'Update Special' : 'Add Special'}
                    </button>
                </form>

                {/* Messages */}
                {successMessage && (
                    <div className="mb-4 p-2 bg-green-600 rounded">{successMessage}</div>
                )}
                {errorMessage && (
                    <div className="mb-4 p-2 bg-red-600 rounded">{errorMessage}</div>
                )}

                {/* Filter Tabs */}
                <div className="mb-6 flex gap-4 border-b border-neutral-700 pb-2">
                    <button 
                        className={`py-2 px-4 ${activeTab === 'all' ? 'border-b-2 border-indigo-500 text-white' : 'text-neutral-400'}`}
                        onClick={() => setActiveTab('all')}
                    >
                        All Specials
                    </button>
                    <button 
                        className={`py-2 px-4 flex items-center gap-2 ${activeTab === 'exclusive' ? 'border-b-2 border-yellow-500 text-white' : 'text-neutral-400'}`}
                        onClick={() => setActiveTab('exclusive')}
                    >
                        <FaStar className="text-yellow-500" /> Exclusive Specials
                    </button>
                    <button 
                        className={`py-2 px-4 ${activeTab === 'stackable' ? 'border-b-2 border-green-500 text-white' : 'text-neutral-400'}`}
                        onClick={() => setActiveTab('stackable')}
                    >
                        Stackable Specials
                    </button>
                </div>
                
                {/* Specials List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredSpecials().map(special => (
                        <div key={special.id} className={`p-5 bg-neutral-800 rounded-lg shadow-md border ${special.mutuallyExclusive ? 'border-yellow-700 hover:border-yellow-600' : 'border-neutral-700 hover:border-neutral-600'} transition-colors`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold text-white">{special.name}</h3>
                                    <p className="text-neutral-400 mt-1">{special.description}</p>
                                    <div className="mt-3 space-y-3">
                                        <p className="flex items-center gap-2 text-indigo-200">
                                            <span className="font-semibold inline-flex items-center"><FaTag className="mr-1" /> Buy:</span> {special.triggerQuantity} × 
                                            <span className="font-medium">
                                                {special.triggerType === 'product' 
                                                    ? (products.find(p => p.id === special.triggerProduct)?.name || 'Unknown Product')
                                                    : formatCategoryName(special.triggerCategory)}
                                                {special.triggerProductSize && ` (${special.triggerProductSize})`}
                                                {special.triggerCategorySize && ` (${special.triggerCategorySize})`}
                                            </span>
                                        </p>
                                        <p className="flex items-center gap-2 text-green-200">
                                            <span className="font-semibold inline-flex items-center"><FaTag className="mr-1" /> Get:</span> {special.rewardQuantity} × 
                                            <span className="font-medium">
                                                {special.rewardType === 'product' 
                                                    ? (products.find(p => p.id === special.rewardProduct)?.name || 'Unknown Product')
                                                    : formatCategoryName(special.rewardCategory)}
                                                {special.rewardProductSize && ` (${special.rewardProductSize})`}
                                                {special.rewardCategorySize && ` (${special.rewardCategorySize})`}
                                            </span>
                                            <span className="font-bold">
                                                {special.discountType === 'free' ? ' FREE' : ` ${special.discountValue}% off`}
                                            </span>
                                        </p>
                                        {special.mutuallyExclusive && (
                                            <p className="text-sm text-yellow-400 font-medium flex items-center gap-1 bg-yellow-900/30 p-1.5 rounded">
                                                <FaStar className="text-yellow-500" />
                                                <span>Exclusive: Cannot combine with other specials</span>
                                            </p>
                                        )}
                                        {special.startDate && special.endDate && (
                                            <p className="text-sm text-neutral-400 flex items-center gap-1">
                                                <FaCalendarAlt className="text-neutral-500" />
                                                Valid: {new Date(special.startDate).toLocaleDateString()} - 
                                                {new Date(special.endDate).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleStartEdit(special)}
                                        className="text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        <FaEdit />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(special.id)}
                                        className="text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        <FaTrashAlt />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </RouteGuard>
    );
}
