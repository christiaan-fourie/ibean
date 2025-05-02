'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { FaRegCircle, FaCheckCircle, FaTrashAlt, FaEdit } from 'react-icons/fa';
import db from '../../../utils/firebase';

// Define coffee sizes
const COFFEE_SIZES = ['Solo', 'Short', 'Tall', 'Black'];

export default function Products() {
    const [products, setProducts] = useState([]);
    const [newProduct, setNewProduct] = useState({
        name: '',
        price: '',
        sizes: {},
        description: '',
        category: '',
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
            if (editingProductId) {
                await updateDoc(doc(db, 'products', editingProductId), newProduct);
                setProducts(products.map(p => 
                    p.id === editingProductId ? { ...newProduct, id: editingProductId } : p
                ));
                setSuccessMessage('Product updated successfully');
            } else {
                const docRef = await addDoc(collection(db, 'products'), newProduct);
                setProducts([...products, { ...newProduct, id: docRef.id }]);
                setSuccessMessage('Product added successfully');
            }
            resetForm();
        } catch (error) {
            setErrorMessage('Failed to save product');
            console.error('Error saving product:', error);
        }
    };

    return (
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
                    <div className="flex gap-2">
                        {['Coffee', 'Food', 'Drink'].map(category => (
                            <button
                                key={category}
                                type="button"
                                onClick={() => handleCategorySelect(category)}
                                className={`p-2 rounded ${
                                    newProduct.category === category 
                                    ? 'bg-indigo-600' 
                                    : 'bg-neutral-700'
                                }`}
                            >
                                {category}
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
                    </div>
                ))}
            </div>
        </div>
    );
}