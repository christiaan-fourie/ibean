'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { FaEdit, FaTrashAlt } from 'react-icons/fa';
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
        const { name, value } = e.target;
        setNewSpecial(prev => ({
            ...prev,
            [name]: value
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
        return product?.category === 'Coffee';
    };

    return (
        <RouteGuard requiredRoles={['manager']}>
            <div className="flex flex-col min-h-screen p-4 bg-neutral-900 text-neutral-50">
                <h1 className="text-3xl font-bold mb-6">Specials Management</h1>

                {/* Form Section */}
                <form onSubmit={handleSubmit} className="mb-8 p-4 bg-neutral-800 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

                    {/* Trigger Section */}
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-2">Trigger Conditions</h3>
                        <div className="flex flex-col gap-2">
                            <select
                                name="triggerType"
                                value={newSpecial.triggerType}
                                onChange={handleChange}
                                className="p-2 bg-neutral-700 rounded"
                            >
                                <option value="product">Specific Product</option>
                                <option value="category">Category</option>
                            </select>

                            {newSpecial.triggerType === 'product' && (
                                <select
                                    name="triggerProduct"
                                    value={newSpecial.triggerProduct}
                                    onChange={handleChange}
                                    className="p-2 bg-neutral-700 rounded"
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
                                    className="p-2 bg-neutral-700 rounded"
                                >
                                    <option value="">Select Category</option>
                                    {products
                                        .map(p => p.category)
                                        .filter((value, index, self) => self.indexOf(value) === index)
                                        .map(category => (
                                            <option key={category} value={category}>
                                                {category}
                                            </option>
                                        ))}
                                </select>
                            )}

                            {newSpecial.triggerType === 'product' && isCoffeeProduct(newSpecial.triggerProduct) && (
                                <select
                                    name="triggerProductSize"
                                    value={newSpecial.triggerProductSize}
                                    onChange={handleChange}
                                    className="p-2 bg-neutral-700 rounded"
                                >
                                    <option value="">Select Size</option>
                                    {['Solo', 'Short', 'Tall', 'Black'].map(size => (
                                        <option key={size} value={size}>
                                            {size}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {newSpecial.triggerType === 'category' && newSpecial.triggerCategory === 'Coffee' && (
                                <select
                                    name="triggerCategorySize"
                                    value={newSpecial.triggerCategorySize}
                                    onChange={handleChange}
                                    className="p-2 bg-neutral-700 rounded"
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
                                className="p-2 bg-neutral-700 rounded"
                                required
                            />
                        </div>
                    </div>

                    {/* Reward Section */}
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Reward Conditions</h3>
                        <div className="flex flex-col gap-2">
                            <select
                                name="rewardType"
                                value={newSpecial.rewardType}
                                onChange={handleChange}
                                className="p-2 bg-neutral-700 rounded"
                            >
                                <option value="product">Specific Product</option>
                                <option value="category">Category</option>
                            </select>

                            {newSpecial.rewardType === 'product' && (
                                <select
                                    name="rewardProduct"
                                    value={newSpecial.rewardProduct}
                                    onChange={handleChange}
                                    className="p-2 bg-neutral-700 rounded"
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
                                    className="p-2 bg-neutral-700 rounded"
                                >
                                    <option value="">Select Category</option>
                                    {products
                                        .map(p => p.category)
                                        .filter((value, index, self) => self.indexOf(value) === index)
                                        .map(category => (
                                            <option key={category} value={category}>
                                                {category}
                                            </option>
                                        ))}
                                </select>
                            )}

                            {newSpecial.rewardType === 'product' && isCoffeeProduct(newSpecial.rewardProduct) && (
                                <select
                                    name="rewardProductSize"
                                    value={newSpecial.rewardProductSize}
                                    onChange={handleChange}
                                    className="p-2 bg-neutral-700 rounded"
                                >
                                    <option value="">Select Size</option>
                                    {['Solo', 'Short', 'Tall', 'Black'].map(size => (
                                        <option key={size} value={size}>
                                            {size}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {newSpecial.rewardType === 'category' && newSpecial.rewardCategory === 'Coffee' && (
                                <select
                                    name="rewardCategorySize"
                                    value={newSpecial.rewardCategorySize}
                                    onChange={handleChange}
                                    className="p-2 bg-neutral-700 rounded"
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
                                className="p-2 bg-neutral-700 rounded"
                                required
                            />
                        </div>
                    </div>

                    <select
                        name="discountType"
                        value={newSpecial.discountType}
                        onChange={handleChange}
                        className="p-2 bg-neutral-700 rounded"
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
                            className="p-2 bg-neutral-700 rounded"
                        />
                    )}

                    <input
                        type="date"
                        name="startDate"
                        value={newSpecial.startDate}
                        onChange={handleChange}
                        className="p-2 bg-neutral-700 rounded"
                    />

                    <input
                        type="date"
                        name="endDate"
                        value={newSpecial.endDate}
                        onChange={handleChange}
                        className="p-2 bg-neutral-700 rounded"
                    />

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            name="mutuallyExclusive"
                            checked={newSpecial.mutuallyExclusive || false}
                            onChange={handleChange}
                            className="w-4 h-4 text-indigo-600 bg-gray-100 rounded border-gray-300 focus:ring-indigo-500"
                        />
                        <label htmlFor="mutuallyExclusive" className="text-neutral-400">
                            Mutually Exclusive (Cannot stack with other specials)
                        </label>
                    </div>

                    <button
                        type="submit"
                        className="w-full p-2 bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
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

                {/* Specials List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {specials.map(special => (
                        <div key={special.id} className="p-4 bg-neutral-800 rounded-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold">{special.name}</h3>
                                    <p className="text-neutral-400">{special.description}</p>
                                    <div className="mt-2">
                                        <p>
                                            Buy {special.triggerQuantity} x {products.find(p => p.id === special.triggerProduct)?.name}
                                            {special.triggerProductSize && ` (${special.triggerProductSize})`}
                                        </p>
                                        <p>
                                            Get {special.rewardQuantity} x {products.find(p => p.id === special.rewardProduct)?.name}
                                            {special.rewardProductSize && ` (${special.rewardProductSize})`}
                                            {special.discountType === 'free' ? ' free' : ` ${special.discountValue}% off`}
                                        </p>
                                        {special.startDate && special.endDate && (
                                            <p className="text-sm text-neutral-500">
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