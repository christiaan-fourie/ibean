'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { FaRegCircle, FaCheckCircle, FaTrashAlt, FaEdit } from 'react-icons/fa';
import db from '../../../utils/firebase';
import { getAuth } from 'firebase/auth';
import RouteGuard from '../../components/RouteGuard';


// Define coffee sizes
const COFFEE_SIZES = ['Solo', 'Short', 'Tall', 'Black'];

export default function Products() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [staffAuth, setStaffAuth] = useState(null);
    const [newProduct, setNewProduct] = useState({
        name: '',
        price: '',
        sizes: {},
        description: '',
        category: '',
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

    // Add after existing useEffect
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

    const handleCategorySelect = (category) => {
        setNewProduct(prev => ({
            ...prev,
            category,
            price: '',
            sizes: category === 'Coffee' ? {} : ''
        }));
    };

    const resetForm = () => {
        setNewProduct({
            name: '',
            price: '',
            sizes: {},
            description: '',
            category: ''
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
                    {newProduct.category !== 'Coffee' && (
                        <input
                            type="number"
                            name="price"
                            value={newProduct.price}
                            onChange={handleChange}
                            placeholder="Price"
                            step="0.01"
                            className="p-2 bg-neutral-700 rounded"
                            required
                        />
                    )}
                    <textarea
                        name="description"
                        value={newProduct.description}
                        onChange={handleChange}
                        placeholder="Description"
                        className="p-2 bg-neutral-700 rounded"
                    />
                    <div className="flex flex-wrap gap-2">
                        {categories.map(category => (
                            <button
                                key={category.id}
                                type="button"
                                onClick={() => handleCategorySelect(category.name)}
                                className={`p-2 rounded ${
                                    newProduct.category === category.name 
                                    ? 'bg-indigo-600' 
                                    : 'bg-neutral-700'
                                }`}
                            >
                                {category.name}
                            </button>
                        ))}
                    </div>
                </div>

                {newProduct.category === 'Coffee' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        {COFFEE_SIZES.map(size => (
                            <div key={size} className="flex items-center gap-2">
                                <input
                                    type="number"
                                    name={`sizes.${size}`}
                                    value={newProduct.sizes[size] || ''}
                                    onChange={(e) => {
                                        setNewProduct(prev => ({
                                            ...prev,
                                            sizes: {
                                                ...prev.sizes,
                                                [size]: e.target.value
                                            }
                                        }));
                                    }}
                                    placeholder={`${size} Price`}
                                    step="0.01"
                                    className="p-2 bg-neutral-700 rounded w-full"
                                />
                            </div>
                        ))}
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
                        {product.category === 'Coffee' ? (
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(product.sizes).map(([size, price]) => (
                                    <div key={size} className="flex justify-between">
                                        <span>{size}</span>
                                        <span>R {safeFormatPrice(price)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xl">R {safeFormatPrice(product.price)}</p>
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