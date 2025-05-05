'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { FaRegCircle, FaCheckCircle, FaTrashAlt, FaEdit } from 'react-icons/fa';
import db from '../../../utils/firebase';
import { getAuth } from 'firebase/auth';
import RouteGuard from '../../components/RouteGuard';

export default function Products() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [staffAuth, setStaffAuth] = useState(null);
    const [newProduct, setNewProduct] = useState({
        name: '',
        description: '',
        category: '',
        price: '', // Add single price field
        varietyPrices: {},
        createdBy: null,
        storeId: null,
        createdAt: null,
        updatedAt: null,
        updatedBy: null
    });
    const [editingProductId, setEditingProductId] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Fetch products on component mount
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'products'));
                const productsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setProducts(productsData);
            } catch (error) {
                setErrorMessage('Failed to fetch products');
                console.error('Error fetching products:', error);
            }
        };
        fetchProducts();
    }, []);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'categories'));
                const categoriesData = querySnapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    .filter(category => category.active); // Only show active categories
                setCategories(categoriesData);
            } catch (error) {
                setErrorMessage('Failed to fetch categories');
                console.error('Error fetching categories:', error);
            }
        };

        const getStaffAuth = () => {
            const auth = localStorage.getItem('staffAuth');
            if (auth) {
                setStaffAuth(JSON.parse(auth));
            }
        };

        fetchCategories();
        getStaffAuth();
    }, []);

    const safeFormatPrice = (priceValue) => {
        const price = parseFloat(priceValue);
        return isNaN(price) ? '0.00' : price.toFixed(2);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setNewProduct(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleCategorySelect = (categoryName) => {
        const category = categories.find(c => c.name === categoryName);
        setSelectedCategory(category);
        setNewProduct(prev => ({
            ...prev,
            category: categoryName,
            price: '', // Reset single price
            varietyPrices: {} // Reset variety prices
        }));
    };

    const resetForm = () => {
        setNewProduct({
            name: '',
            description: '',
            category: '',
            price: '',
            varietyPrices: {},
            createdBy: null,
            storeId: null,
            createdAt: null,
            updatedAt: null,
            updatedBy: null
        });
        setEditingProductId(null);
    };

    const handleStartEdit = (product) => {
        setEditingProductId(product.id);
        setNewProduct(product);
    };

    const handleDeleteProduct = async (productId) => {
        try {
            await deleteDoc(doc(db, 'products', productId));
            setProducts(products.filter(p => p.id !== productId));
            setSuccessMessage('Product deleted successfully');
        } catch (error) {
            setErrorMessage('Failed to delete product');
            console.error('Error deleting product:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const auth = getAuth();
            const now = new Date().toISOString();
            const productData = {
                ...newProduct,
                storeId: auth.currentUser.uid,
                updatedAt: now
            };
    
            if (editingProductId) {
                productData.updatedBy = {
                    id: staffAuth.staffId,
                    name: staffAuth.staffName,
                    role: staffAuth.accountType
                };
                
                await updateDoc(doc(db, 'products', editingProductId), productData);
                setProducts(products.map(p => 
                    p.id === editingProductId ? { ...productData, id: editingProductId } : p
                ));
                setSuccessMessage('Product updated successfully');
            } else {
                productData.createdAt = now;
                productData.createdBy = {
                    id: staffAuth.staffId,
                    name: staffAuth.staffName,
                    role: staffAuth.accountType
                };
    
                const docRef = await addDoc(collection(db, 'products'), productData);
                setProducts([...products, { ...productData, id: docRef.id }]);
                setSuccessMessage('Product added successfully');
            }
            resetForm();
        } catch (error) {
            setErrorMessage('Failed to save product');
            console.error('Error saving product:', error);
        }
    };

    return (
        <RouteGuard requiredRoles={['manager']}>
        <div className="flex flex-col min-h-screen p-4 bg-neutral-900 text-neutral-50">
            <h1 className="text-3xl font-bold mb-6">Products Management</h1>

            {/* Form Section */}
            <form onSubmit={handleSubmit} className="mb-8 p-4 bg-neutral-800 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input
                        type="text"
                        name="name"
                        value={newProduct.name}
                        onChange={handleChange}
                        placeholder="Product Name"
                        className="p-2 bg-neutral-700 rounded"
                        required
                    />
                    <div className="flex flex-wrap gap-2">
                        {categories.length === 0 ? (
                            <p className="text-neutral-400">Loading categories...</p>
                        ) : (
                            categories.map(category => (
                                <button
                                    key={category.id}
                                    type="button"
                                    onClick={() => handleCategorySelect(category.name)}
                                    className={`p-2 rounded transition-colors ${
                                        newProduct.category === category.name 
                                        ? 'bg-indigo-600 hover:bg-indigo-700' 
                                        : 'bg-neutral-700 hover:bg-neutral-600'
                                    }`}
                                >
                                    {category.name}
                                    {newProduct.category === category.name && (
                                        <FaCheckCircle className="inline-block ml-2" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                    <textarea
                        name="description"
                        value={newProduct.description}
                        onChange={handleChange}
                        placeholder="Description"
                        className="p-2 bg-neutral-700 rounded"
                    />
                    
                </div>

                {selectedCategory?.varieties?.length > 0 ? (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-neutral-300 mb-2">
                            Variety Prices
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {selectedCategory.varieties.map(variety => (
                                <div key={variety} className="flex flex-col gap-1">
                                    <label className="text-sm text-neutral-400">{variety}</label>
                                    <input
                                        type="number"
                                        value={newProduct.varietyPrices[variety] || ''}
                                        onChange={(e) => {
                                            setNewProduct(prev => ({
                                                ...prev,
                                                varietyPrices: {
                                                    ...prev.varietyPrices,
                                                    [variety]: e.target.value
                                                }
                                            }));
                                        }}
                                        placeholder={`Price for ${variety}`}
                                        step="0.01"
                                        min="0"
                                        className="p-2 bg-neutral-700 rounded w-full"
                                        required
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-neutral-300 mb-2">
                            Price
                        </label>
                        <input
                            type="number"
                            name="price"
                            value={newProduct.price}
                            onChange={handleChange}
                            placeholder="Product Price"
                            step="0.01"
                            min="0"
                            className="p-2 bg-neutral-700 rounded w-full"
                            required={!selectedCategory?.varieties?.length}
                        />
                    </div>
                )}

                
                <button
                    type="submit"
                    className="w-full p-2 bg-indigo-600 hover:bg-indigo-700 rounded"
                >
                    {editingProductId ? 'Update Product' : 'Add Product'}
                </button>
            </form>

            {/* Messages */}
            {successMessage && (
                <div className="mb-4 p-2 bg-green-600 rounded">{successMessage}</div>
            )}
            {errorMessage && (
                <div className="mb-4 p-2 bg-red-600 rounded">{errorMessage}</div>
            )}

            {/* Products List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map(product => (
                    <div key={product.id} className="p-4 bg-neutral-800 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xl font-bold">{product.name}</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleStartEdit(product)}
                                    className="text-blue-400 hover:text-blue-300"
                                >
                                    <FaEdit />
                                </button>
                                <button
                                    onClick={() => handleDeleteProduct(product.id)}
                                    className="text-red-400 hover:text-red-300"
                                >
                                    <FaTrashAlt />
                                </button>
                            </div>
                        </div>
                        <p className="text-neutral-400 mb-2">{product.description}</p>
                        {product.varietyPrices && Object.keys(product.varietyPrices).length > 0 ? (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {Object.entries(product.varietyPrices).map(([variety, price]) => (
                                    <div key={variety} className="flex justify-between items-center p-2 bg-neutral-700 rounded">
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
                            <p className="text-red-400 mt-2">No price set</p>
                        )}
                        <div className="mt-4 pt-2 border-t border-neutral-700 text-xs text-neutral-500">
                            {product.createdBy && (
                                <p>Created by: {product.createdBy.name}</p>
                            )}
                            {product.createdAt && (
                                <p>Created: {new Date(product.createdAt).toLocaleDateString()}</p>
                            )}
                            {product.updatedBy && (
                                <p>Last updated by: {product.updatedBy.name}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
        </RouteGuard>
    );
}