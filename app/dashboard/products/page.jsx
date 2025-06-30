'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { FaRegCircle, FaCheckCircle, FaTrashAlt, FaEdit, FaExclamationCircle } from 'react-icons/fa';
import db from '../../../utils/firebase';
import { getAuth } from 'firebase/auth';
import RouteGuard from '../../components/RouteGuard';
import { FaTools, FaExclamationTriangle } from 'react-icons/fa';


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

// New Data Auditing Component
const ProductDataAuditor = ({ products, categories, onStartEdit, showNotification }) => {
    const [issues, setIssues] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    const runAudit = () => {
        setIsScanning(true);
        const foundIssues = [];

        products.forEach(product => {
            const productIssues = [];
            // 1. Check for invalid price types
            if (product.price && typeof product.price !== 'number') {
                productIssues.push({ type: 'INVALID_PRICE_TYPE', message: `Price is a ${typeof product.price}, should be a number.` });
            }
            if (product.varietyPrices) {
                Object.entries(product.varietyPrices).forEach(([variety, price]) => {
                    if (price && typeof price !== 'number') {
                        productIssues.push({ type: 'INVALID_VARIETY_PRICE_TYPE', message: `Variety '${variety}' price is a ${typeof price}, should be a number.` });
                    }
                });
            }

            // 2. Check for invalid category
            if (!categories.some(cat => cat.name === product.category)) {
                productIssues.push({ type: 'INVALID_CATEGORY', message: `Category '${product.category}' does not exist or is inactive.` });
            }
            
            // 3. Check for missing required fields
            if (!product.name) productIssues.push({ type: 'MISSING_FIELD', message: "Product is missing a name." });
            if (!product.category) productIssues.push({ type: 'MISSING_FIELD', message: "Product is missing a category." });
            if (!product.createdAt) productIssues.push({ type: 'MISSING_FIELD', message: "Product is missing creation date." });


            if (productIssues.length > 0) {
                foundIssues.push({ ...product, issues: productIssues });
            }
        });

        setIssues(foundIssues);
        setIsScanning(false);
        showNotification(`Audit complete. Found ${foundIssues.length} products with issues.`, 'success');
    };

    const handleFixIssue = async (product, issue) => {
        let fixable = true;
        const updatedData = {};

        switch (issue.type) {
            case 'INVALID_PRICE_TYPE':
                updatedData.price = parseFloat(product.price);
                break;
            case 'INVALID_VARIETY_PRICE_TYPE':
                updatedData.varietyPrices = { ...product.varietyPrices };
                Object.entries(updatedData.varietyPrices).forEach(([variety, price]) => {
                    if (typeof price !== 'number') {
                        updatedData.varietyPrices[variety] = parseFloat(price);
                    }
                });
                break;
            default:
                fixable = false;
                showNotification('This issue requires manual correction.', 'error');
                onStartEdit(product);
                break;
        }

        if (fixable) {
            try {
                await updateDoc(doc(db, 'products', product.id), updatedData);
                showNotification(`Successfully fixed ${issue.type} for ${product.name}.`, 'success');
                // Re-run audit to clear the fixed issue from the list
                runAudit();
            } catch (error) {
                showNotification(`Failed to fix issue: ${error.message}`, 'error');
                console.error("Failed to fix product data:", error);
            }
        }
    };

    return (
        <div className="mt-12 p-6 bg-neutral-800 rounded-lg border border-neutral-700">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-3"><FaTools /> Data Integrity Audit</h2>
                <button onClick={runAudit} disabled={isScanning} className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded disabled:bg-neutral-600">
                    {isScanning ? 'Scanning...' : 'Scan Products'}
                </button>
            </div>
            <p className="text-neutral-400 mb-4 text-sm">This tool scans for data inconsistencies like incorrect types or missing fields and provides options to fix them.</p>
            
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {issues.length > 0 ? (
                    issues.map(product => (
                        <div key={product.id} className="p-4 bg-neutral-700/50 rounded-lg border border-amber-500/50">
                            <h3 className="font-bold text-white">{product.name}</h3>
                            <ul className="list-disc list-inside mt-2 space-y-2 text-sm">
                                {product.issues.map((issue, index) => (
                                    <li key={index} className="flex justify-between items-center">
                                        <span className="text-amber-400 flex items-center gap-2"><FaExclamationTriangle /> {issue.message}</span>
                                        <button onClick={() => handleFixIssue(product, issue)} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded">
                                            {['INVALID_CATEGORY', 'MISSING_FIELD'].includes(issue.type) ? 'Edit Manually' : 'Attempt Fix'}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))
                ) : (
                    <p className="text-neutral-500 text-center py-4">No issues found, or no audit has been run yet.</p>
                )}
            </div>
        </div>
    );
};


export default function Products() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [staffAuth, setStaffAuth] = useState(null);
    const [newProduct, setNewProduct] = useState({
        name: '',
        description: '',
        category: '',
        price: '',
        varietyPrices: {},
    });
    const [editingProductId, setEditingProductId] = useState(null);
    const [notification, setNotification] = useState({ key: 0, message: '', type: '' });
    const [isLoading, setIsLoading] = useState(false);

    // Real-time data fetching and initial setup
    useEffect(() => {
        const authData = localStorage.getItem('staffAuth');
        if (authData) setStaffAuth(JSON.parse(authData));

        // Real-time listener for products
        const productsQuery = query(collection(db, 'products'), orderBy('name'));
        const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(productsData);
        }, (error) => {
            showNotification('Failed to fetch products in real-time.', 'error');
            console.error(error);
        });

        // Real-time listener for categories
        const categoriesQuery = query(collection(db, 'categories'), orderBy('order'));
        const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
            const categoriesData = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(cat => cat.active);
            setCategories(categoriesData);
        }, (error) => {
            showNotification('Failed to fetch categories in real-time.', 'error');
            console.error(error);
        });

        return () => {
            unsubscribeProducts();
            unsubscribeCategories();
        };
    }, []);

    const showNotification = (message, type) => {
        setNotification({ key: Date.now(), message, type });
    };

    // New robust date formatting function
    const safeFormatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        // Firestore Timestamps have a toDate() method
        if (typeof timestamp.toDate === 'function') {
            return timestamp.toDate().toLocaleDateString();
        }
        // Handle if it's already a JS Date object or a string
        try {
            return new Date(timestamp).toLocaleDateString();
        } catch (e) {
            return 'Invalid Date';
        }
    };

    const safeFormatPrice = (priceValue) => {
        const price = parseFloat(priceValue);
        return isNaN(price) ? '0.00' : price.toFixed(2);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setNewProduct(prev => ({ ...prev, [name]: value }));
    };

    const handleCategorySelect = (category) => {
        setSelectedCategory(category);
        setNewProduct(prev => ({
            ...prev,
            category: category.name,
            price: '',
            varietyPrices: {}
        }));
    };

    const resetForm = () => {
        setNewProduct({ name: '', description: '', category: '', price: '', varietyPrices: {} });
        setEditingProductId(null);
        setSelectedCategory(null);
    };

    const handleStartEdit = (product) => {
        setEditingProductId(product.id);
        setNewProduct(product);
        const category = categories.find(c => c.name === product.category);
        setSelectedCategory(category);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteProduct = async (productId) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await deleteDoc(doc(db, 'products', productId));
            showNotification('Product deleted successfully.', 'success');
        } catch (error) {
            showNotification('Failed to delete product.', 'error');
            console.error('Error deleting product:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const auth = getAuth();
            const now = Timestamp.now();
            
            // Sanitize and build the data object to enforce correct data types
            const productData = {
                name: newProduct.name.trim(),
                description: newProduct.description.trim(),
                category: newProduct.category,
                storeId: auth.currentUser.uid,
                updatedAt: now,
            };

            // Ensure price is a number or null
            const priceValue = parseFloat(newProduct.price);
            productData.price = !isNaN(priceValue) ? priceValue : null;

            // Ensure all variety prices are numbers
            productData.varietyPrices = {};
            if (newProduct.varietyPrices) {
                Object.entries(newProduct.varietyPrices).forEach(([key, value]) => {
                    const varietyPriceValue = parseFloat(value);
                    if (!isNaN(varietyPriceValue)) {
                        productData.varietyPrices[key] = varietyPriceValue;
                    }
                });
            }

            // If there are no variety prices, remove the empty map
            if (Object.keys(productData.varietyPrices).length === 0) {
                delete productData.varietyPrices;
            }
            // If there is a price, ensure varietyPrices is not also set
            if (productData.price !== null) {
                 delete productData.varietyPrices;
            }


            if (editingProductId) {
                productData.updatedBy = { id: staffAuth.staffId, name: staffAuth.staffName, role: staffAuth.accountType };
                // Preserve original creation data when updating
                productData.createdAt = newProduct.createdAt;
                productData.createdBy = newProduct.createdBy;
                await updateDoc(doc(db, 'products', editingProductId), productData);
                showNotification('Product updated successfully.', 'success');
            } else {
                productData.createdAt = now;
                productData.createdBy = { id: staffAuth.staffId, name: staffAuth.staffName, role: staffAuth.accountType };
                await addDoc(collection(db, 'products'), productData);
                showNotification('Product added successfully.', 'success');
            }
            resetForm();
        } catch (error) {
            showNotification('Failed to save product. ' + error.message, 'error');
            console.error('Error saving product:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <RouteGuard requiredRoles={['manager']}>
            <div className="flex flex-col min-h-screen p-4 bg-neutral-900 text-neutral-50">
                {notification.message && (
                    <Toast
                        key={notification.key}
                        message={notification.message}
                        type={notification.type}
                        onClose={() => setNotification({ message: '', type: '' })}
                    />
                )}

                <h1 className="text-3xl font-bold mb-6">Products Management</h1>

                <form onSubmit={handleSubmit} className="mb-8 p-4 bg-neutral-800 rounded-lg border border-neutral-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <input
                            type="text" name="name" value={newProduct.name} onChange={handleChange}
                            placeholder="Product Name" className="p-2 bg-neutral-700 rounded" required
                        />
                        <div className="flex flex-wrap gap-2 p-2 bg-neutral-700 rounded items-center">
                            {categories.length === 0 ? (
                                <p className="text-neutral-400">Loading categories...</p>
                            ) : (
                                categories.map(category => (
                                    <button
                                        key={category.id} type="button" onClick={() => handleCategorySelect(category)}
                                        className={`p-2 rounded transition-colors text-sm ${
                                            newProduct.category === category.name
                                                ? 'bg-indigo-600 hover:bg-indigo-700'
                                                : 'bg-neutral-600 hover:bg-neutral-500'
                                        }`}
                                    >
                                        {category.name}
                                        {newProduct.category === category.name && <FaCheckCircle className="inline-block ml-2" />}
                                    </button>
                                ))
                            )}
                        </div>
                        <textarea
                            name="description" value={newProduct.description} onChange={handleChange}
                            placeholder="Description" className="p-2 bg-neutral-700 rounded md:col-span-2"
                        />
                    </div>

                    {selectedCategory && (
                        selectedCategory.varieties?.length > 0 ? (
                            <div className="mb-4 p-4 bg-neutral-900/50 rounded-md">
                                <label className="block text-sm font-medium text-neutral-300 mb-2">Variety Prices for {selectedCategory.name}</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {selectedCategory.varieties.map(variety => (
                                        <div key={variety} className="flex flex-col gap-1">
                                            <label className="text-sm text-neutral-400">{variety}</label>
                                            <input
                                                type="number" value={newProduct.varietyPrices[variety] || ''}
                                                onChange={(e) => setNewProduct(prev => ({ ...prev, varietyPrices: { ...prev.varietyPrices, [variety]: e.target.value } }))}
                                                placeholder={`Price`} step="0.01" min="0"
                                                className="p-2 bg-neutral-700 rounded w-full" required
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="mb-4 p-4 bg-neutral-900/50 rounded-md">
                                <label className="block text-sm font-medium text-neutral-300 mb-2">Standard Price</label>
                                <input
                                    type="number" name="price" value={newProduct.price} onChange={handleChange}
                                    placeholder="Product Price" step="0.01" min="0"
                                    className="p-2 bg-neutral-700 rounded w-full max-w-xs" required={!selectedCategory?.varieties?.length}
                                />
                            </div>
                        )
                    )}

                    <div className="flex gap-4">
                        <button type="submit" disabled={isLoading} className="flex-grow p-2 bg-indigo-600 hover:bg-indigo-700 rounded disabled:bg-neutral-600">
                            {isLoading ? 'Saving...' : (editingProductId ? 'Update Product' : 'Add Product')}
                        </button>
                        {editingProductId && (
                            <button type="button" onClick={resetForm} className="p-2 bg-neutral-600 hover:bg-neutral-500 rounded">
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {products.map(product => (
                        <div key={product.id} className="p-4 bg-neutral-800 rounded-lg border border-neutral-700 flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-xl font-bold flex-grow pr-2">{product.name}</h3>
                                <div className="flex gap-2 flex-shrink-0">
                                    <button onClick={() => handleStartEdit(product)} className="text-blue-400 hover:text-blue-300"><FaEdit /></button>
                                    <button onClick={() => handleDeleteProduct(product.id)} className="text-red-400 hover:text-red-300"><FaTrashAlt /></button>
                                </div>
                            </div>
                            <p className="text-neutral-400 mb-2 text-sm flex-grow">{product.description}</p>
                            {product.varietyPrices && Object.keys(product.varietyPrices).length > 0 ? (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    {Object.entries(product.varietyPrices).map(([variety, price]) => (
                                        <div key={variety} className="flex justify-between items-center p-2 bg-neutral-700 rounded text-sm">
                                            <span className="font-medium">{variety}</span>
                                            <span className="text-indigo-400">R {safeFormatPrice(price)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : product.price ? (
                                <div className="p-2 bg-neutral-700 rounded mt-2">
                                    <span className="text-indigo-400 text-xl">R {safeFormatPrice(product.price)}</span>
                                </div>
                            ) : (
                                <p className="text-amber-500 mt-2 text-sm">No price set</p>
                            )}
                            <div className="mt-4 pt-2 border-t border-neutral-700 text-xs text-neutral-500">
                                {product.updatedBy ? (
                                    <p>Updated by: {product.updatedBy.name} on {safeFormatDate(product.updatedAt)}</p>
                                ) : (
                                    <p>Created by: {product.createdBy?.name} on {safeFormatDate(product.createdAt)}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <ProductDataAuditor 
                    products={products} 
                    categories={categories}
                    onStartEdit={handleStartEdit}
                    showNotification={showNotification}
                />
            </div>
        </RouteGuard>
    );
}