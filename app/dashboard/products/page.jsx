'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { FaCheckCircle, FaEdit } from 'react-icons/fa';
import db from '../../../utils/firebase';
import { getAuth } from 'firebase/auth';
import { getStoreId } from '../../../utils/storeId';
import RouteGuard from '../../components/RouteGuard';
import { useCollectionLive } from '../../hooks/useCollectionLive';
import { useAuditActor } from '../../hooks/useAuditActor';
import { useToastNotification } from '../../hooks/useToastNotification';
import ToastNotification from '../../components/ToastNotification';


export default function Products() {
    const { data: productsData, error: productsError } = useCollectionLive('products');
    const { data: categoriesData, error: categoriesError } = useCollectionLive('categories');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [newProduct, setNewProduct] = useState({
        name: '',
        description: '',
        category: '',
        price: '',
        varietyPrices: {},
    });
    const [editingProductId, setEditingProductId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const { notification, notify, clearNotification } = useToastNotification();
    const products = [...productsData].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const categories = [...categoriesData]
        .filter((cat) => cat.active)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const { hasAuditActor, getAuditActor } = useAuditActor();

    useEffect(() => {
        if (productsError) {
            notify('Failed to fetch products in real-time.', 'error');
            console.error(productsError);
        }
        if (categoriesError) {
            notify('Failed to fetch categories in real-time.', 'error');
            console.error(categoriesError);
        }
    }, [productsError, categoriesError, notify]);

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
        setShowDeleteConfirm(false);
    };

    const handleStartEdit = (product) => {
        setEditingProductId(product.id);
        setNewProduct(product);
        const category = categories.find(c => c.name === product.category);
        setSelectedCategory(category);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteProduct = async (productId) => {
        try {
            await deleteDoc(doc(db, 'products', productId));
            notify('Product deleted successfully.', 'success');
            if (editingProductId === productId) {
                resetForm();
            }
            setShowDeleteConfirm(false);
        } catch (error) {
            notify('Failed to delete product.', 'error');
            console.error('Error deleting product:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!hasAuditActor) {
            notify('Staff audit identity is missing.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const auth = getAuth();
            const now = Timestamp.now();
            
            // Sanitize and build the data object to enforce correct data types
            const productData = {
                name: newProduct.name.trim(),
                description: newProduct.description.trim(),
                category: newProduct.category,
                storeId: getStoreId(auth.currentUser),
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
                productData.updatedBy = getAuditActor();
                // Preserve original creation data when updating
                productData.createdAt = newProduct.createdAt;
                productData.createdBy = newProduct.createdBy;
                await updateDoc(doc(db, 'products', editingProductId), productData);
                notify('Product updated successfully.', 'success');
            } else {
                productData.createdAt = now;
                productData.createdBy = getAuditActor();
                await addDoc(collection(db, 'products'), productData);
                notify('Product added successfully.', 'success');
            }
            resetForm();
        } catch (error) {
            notify('Failed to save product. ' + error.message, 'error');
            console.error('Error saving product:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <RouteGuard requiredRoles={['manager']}>
            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-neutral-900/40 p-3 text-neutral-50 md:p-4">
                {notification.message && (
                    <ToastNotification
                        key={notification.key}
                        message={notification.message}
                        type={notification.type}
                        onClose={clearNotification}
                        containerClassName="fixed bottom-3 right-3 p-2.5 text-sm rounded-md shadow-lg flex items-center gap-2 text-white border animate-fade-in-up z-50"
                    />
                )}

                <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold text-white">Products Management</h1>
                        <p className="text-sm text-neutral-400">Manage names, categories, and prices from one place.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300">
                        {products.length} products
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
                    <section className="min-h-0 rounded-3xl border border-white/10 bg-neutral-900/70 p-4 shadow-xl backdrop-blur-xl md:p-5">
                        <div className="h-full min-h-0 overflow-y-auto pr-1">
                            <form onSubmit={handleSubmit} className="mb-4 text-sm">
                                <div className="mb-4">
                                    <h2 className="text-base font-semibold text-white">{editingProductId ? 'Edit Product' : 'Add Product'}</h2>
                                    <p className="text-xs text-neutral-400">Select a category first, then complete the pricing section.</p>
                                </div>

                                <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1">
                                    <input
                                        type="text" name="name" value={newProduct.name} onChange={handleChange}
                                        placeholder="Product Name" className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-neutral-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25" required
                                    />
                                    <input
                                        type="text" name="description" value={newProduct.description} onChange={handleChange}
                                        placeholder="Description" className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-neutral-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                                    />
                                </div>

                                <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                                    <p className="mb-2 text-xs font-medium text-neutral-300">Category</p>
                                    <div className="flex flex-wrap gap-2 text-sm">
                                        {categories.length === 0 ? (
                                            Array.from({ length: 6 }).map((_, index) => (
                                                <div key={`category-skeleton-${index}`} className="h-9 w-24 animate-pulse rounded-xl bg-white/10" />
                                            ))
                                        ) : (
                                            categories.map(category => (
                                                <button
                                                    key={category.id} type="button" onClick={() => handleCategorySelect(category)}
                                                    className={`min-h-10 rounded-xl px-3 text-xs font-medium transition-colors ${
                                                        newProduct.category === category.name
                                                            ? 'bg-blue-500 text-white'
                                                            : 'border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
                                                    }`}
                                                >
                                                    {category.name}
                                                    {newProduct.category === category.name && <FaCheckCircle className="ml-2 inline-block" />}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {selectedCategory && (
                                    selectedCategory.varieties?.length > 0 ? (
                                        <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                                            <label className="mb-2 block text-xs font-medium text-neutral-300">Variety Prices for {selectedCategory.name}</label>
                                            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-2">
                                                {selectedCategory.varieties.map(variety => (
                                                    <div key={variety} className="flex flex-col gap-1">
                                                        <label className="text-sm text-neutral-400">{variety}</label>
                                                        <input
                                                            type="number" value={newProduct.varietyPrices[variety] || ''}
                                                            onChange={(e) => setNewProduct(prev => ({ ...prev, varietyPrices: { ...prev.varietyPrices, [variety]: e.target.value } }))}
                                                            placeholder={`Price`} step="0.01" min="0"
                                                            className="w-full rounded-xl border border-white/10 bg-neutral-900/70 p-2 text-sm text-white placeholder-neutral-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25" required
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                                            <label className="mb-2 block text-xs font-medium text-neutral-300">Standard Price</label>
                                            <input
                                                type="number" name="price" value={newProduct.price} onChange={handleChange}
                                                placeholder="Product Price" step="0.01" min="0"
                                                className="w-full max-w-xs rounded-xl border border-white/10 bg-neutral-900/70 p-2 text-sm text-white placeholder-neutral-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25" required={!selectedCategory?.varieties?.length}
                                            />
                                        </div>
                                    )
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <button type="submit" disabled={isLoading} className="min-h-11 flex-grow rounded-2xl bg-blue-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:bg-neutral-600">
                                        {isLoading ? 'Saving...' : (editingProductId ? 'Update Product' : 'Add Product')}
                                    </button>
                                    {editingProductId && (
                                        <button type="button" onClick={resetForm} className="min-h-11 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/15">
                                            Cancel Edit
                                        </button>
                                    )}
                                    {editingProductId && (
                                        <button
                                            type="button"
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="min-h-11 rounded-2xl border border-red-400/40 bg-red-500/15 px-4 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/25"
                                        >
                                            Delete Product
                                        </button>
                                    )}
                                </div>
                            </form>

                        </div>
                    </section>

                    <section className="min-h-0 rounded-3xl border border-white/10 bg-neutral-900/70 p-4 shadow-xl backdrop-blur-xl md:p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-white">Product List</h2>
                            <p className="text-xs text-neutral-400">Tap edit to load into the left pane.</p>
                        </div>
                        <div className="grid h-[calc(100%-2.5rem)] min-h-0 grid-cols-1 gap-2.5 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                            {products.map(product => (
                                <div key={product.id} className="flex flex-col rounded-2xl border border-white/10 bg-neutral-900/75 p-3 text-sm shadow-lg backdrop-blur-xl">
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                        <h3 className="flex-grow pr-1 text-base font-semibold text-white">{product.name}</h3>
                                        <div className="flex flex-shrink-0 gap-1 text-sm">
                                            <button onClick={() => handleStartEdit(product)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-blue-300 hover:bg-white/15"><FaEdit /></button>
                                        </div>
                                    </div>
                                    <p className="mb-2 flex-grow text-xs text-neutral-400">{product.description || 'No description'}</p>
                                    {product.varietyPrices && Object.keys(product.varietyPrices).length > 0 ? (
                                        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                                            {Object.entries(product.varietyPrices).map(([variety, price]) => (
                                                <div key={variety} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-1.5 text-xs">
                                                    <span className="font-medium">{variety}</span>
                                                    <span className="text-blue-300">R {safeFormatPrice(price)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : product.price ? (
                                        <div className="mt-1.5 rounded-lg border border-white/10 bg-white/5 p-2">
                                            <span className="text-sm font-semibold text-blue-300">R {safeFormatPrice(product.price)}</span>
                                        </div>
                                    ) : (
                                        <p className="mt-1.5 text-xs text-amber-400">No price set</p>
                                    )}
                                    <div className="mt-3 border-t border-white/10 pt-2 text-[10px] text-neutral-500">
                                        {product.updatedBy ? (
                                            <p>Updated by: {product.updatedBy.name} on {safeFormatDate(product.updatedAt)}</p>
                                        ) : (
                                            <p>Created by: {product.createdBy?.name} on {safeFormatDate(product.createdAt)}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {showDeleteConfirm && editingProductId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900/95 p-5 shadow-2xl">
                            <h3 className="text-lg font-semibold text-white">Delete Product?</h3>
                            <p className="mt-2 text-sm text-neutral-300">
                                This will permanently remove <span className="font-semibold text-white">{newProduct.name || 'this product'}</span>.
                            </p>
                            <p className="mt-1 text-xs text-neutral-400">This action cannot be undone.</p>
                            <div className="mt-5 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="min-h-11 flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteProduct(editingProductId)}
                                    className="min-h-11 flex-1 rounded-2xl bg-red-500 px-4 text-sm font-semibold text-white hover:bg-red-600"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </RouteGuard>
    );
}
