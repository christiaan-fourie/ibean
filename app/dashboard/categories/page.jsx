'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { FaEdit, FaTrashAlt } from 'react-icons/fa';
import db from '../../../utils/firebase';
import RouteGuard from '../../components/RouteGuard';

export default function Categories() {
    const [categories, setCategories] = useState([]);
    const [staffAuth, setStaffAuth] = useState(null);
    const [newCategory, setNewCategory] = useState({
        name: '',
        description: '',
        active: true,
        varieties: [], // Add varieties array
        createdBy: null,
        storeId: null,
        createdAt: null,
        updatedAt: null,
        updatedBy: null,
        order: 0
    });
    const [editingId, setEditingId] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const getStaffAuth = () => {
            const auth = localStorage.getItem('staffAuth');
            if (auth) {
                setStaffAuth(JSON.parse(auth));
            }
        };
    
        getStaffAuth();
    }, []);


    // Fetch categories on component mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'categories'));
                const categoriesData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setCategories(categoriesData);
            } catch (error) {
                setErrorMessage('Failed to fetch categories');
                console.error('Error fetching categories:', error);
            }
        };
        fetchCategories();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setNewCategory(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const resetForm = () => {
        setNewCategory({
            name: '',
            description: '',
            active: true,
            varieties: [], // Reset varieties array
            createdBy: null,
            storeId: null,
            createdAt: null,
            updatedAt: null,
            updatedBy: null,
            order: 0
        });
        setEditingId(null);
    };

    // Update the handleStartEdit function
    const handleStartEdit = (category) => {
        setEditingId(category.id);
        setNewCategory({
            name: category.name,
            description: category.description || '',
            active: category.active ?? true,
            varieties: category.varieties || [], // Include varieties
            createdBy: category.createdBy || null,
            storeId: category.storeId || null,
            createdAt: category.createdAt || null,
            updatedAt: category.updatedAt || null,
            updatedBy: category.updatedBy || null,
            order: category.order || 0
        });
    };

    const handleDelete = async (categoryId) => {
        if (!confirm('Are you sure you want to delete this category?')) return;
        
        try {
            await deleteDoc(doc(db, 'categories', categoryId));
            setCategories(categories.filter(c => c.id !== categoryId));
            setSuccessMessage('Category deleted successfully');
        } catch (error) {
            setErrorMessage('Failed to delete category');
            console.error('Error deleting category:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSuccessMessage('');
        setErrorMessage('');
    
        if (!newCategory.name.trim()) {
            setErrorMessage('Category name is required');
            return;
        }
    
        try {
            const now = new Date().toISOString();
            const categoryData = {
                ...newCategory,
                updatedAt: now
            };
    
            if (editingId) {
                categoryData.updatedBy = {
                    id: staffAuth.staffId,
                    name: staffAuth.staffName,
                    role: staffAuth.accountType
                };
                
                await updateDoc(doc(db, 'categories', editingId), categoryData);
                setCategories(categories.map(c => 
                    c.id === editingId ? { ...categoryData, id: editingId } : c
                ));
                setSuccessMessage('Category updated successfully');
            } else {
                categoryData.createdAt = now;
                categoryData.createdBy = {
                    id: staffAuth.staffId,
                    name: staffAuth.staffName,
                    role: staffAuth.accountType
                };
                categoryData.order = categories.length;
    
                const docRef = await addDoc(collection(db, 'categories'), categoryData);
                setCategories([...categories, { ...categoryData, id: docRef.id }]);
                setSuccessMessage('Category added successfully');
            }
            resetForm();
        } catch (error) {
            setErrorMessage('Failed to save category');
            console.error('Error saving category:', error);
        }
    };

    return (
        <RouteGuard requiredRoles={['manager']}>
        <div className="flex flex-col min-h-screen p-4 bg-neutral-900 text-neutral-50">
            <h1 className="text-3xl font-bold mb-6">Categories Management</h1>

            {/* Form Section */}
            <form className="mb-8 p-4 bg-neutral-800 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input
                        type="text"
                        name="name"
                        value={newCategory.name}
                        onChange={handleChange}
                        placeholder="Category Name"
                        className="p-2 bg-neutral-700 rounded"
                        required
                    />
                    <input
                        type="text"
                        name="description"
                        value={newCategory.description}
                        onChange={handleChange}
                        placeholder="Description"
                        className="p-2 bg-neutral-700 rounded"
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Varieties (comma separated)
                    </label>
                    <div className="mb-4">
                        <input
                            type="text"
                            name="varieties"
                            value={Array.isArray(newCategory.varieties) ? newCategory.varieties.join(',') : ''}
                            onChange={(e) => {
                                const varieties = e.target.value
                                    .split(',')
                                    .map(v => v.trim())
                                    .map(v => v.toLowerCase());
                                setNewCategory(prev => ({
                                    ...prev,
                                    varieties: [...new Set(varieties)]
                                }));
                            }}
                            placeholder="Enter varieties (e.g., Solo,Short,Tall)"
                            className="w-full p-3 bg-neutral-800 rounded-lg border border border-neutral-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                            aria-label="Product varieties input"
                        />
                        <div className="flex items-center justify-between text-xs text-neutral-400 mt-1">
                            <span>Comma separated</span>
                            <span>
                                {Array.isArray(newCategory.varieties) ? newCategory.varieties.length : 0} varieties
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                    <input
                        type="checkbox"
                        id="active"
                        name="active"
                        checked={newCategory.active}
                        onChange={(e) => setNewCategory(prev => ({
                            ...prev,
                            active: e.target.checked
                        }))}
                        className="form-checkbox h-5 w-5 text-indigo-600 rounded bg-neutral-700"
                    />
                    <label htmlFor="active" className="text-neutral-200">Active</label>
                </div>
                <button
                    onClick={handleSubmit}
                    className="w-full p-2 bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                >
                    {editingId ? 'Update Category' : 'Add Category'}
                </button>
            </form>

            {/* Messages */}
            {successMessage && (
                <div className="mb-4 p-2 bg-green-600 rounded">{successMessage}</div>
            )}
            {errorMessage && (
                <div className="mb-4 p-2 bg-red-600 rounded">{errorMessage}</div>
            )}

            {/* Categories List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(category => (
                    // Update the category card in the return statement
                    <div key={category.id} className="p-4 bg-neutral-800 rounded-lg">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold">{category.name}</h3>
                                <p className="text-neutral-400">{category.description}</p>
                                {category.varieties && category.varieties.length > 0 && (
                                    <ul className="mt-2 text-neutral-400 text-sm">
                                        {category.varieties.map((variety, index) => (
                                            <li key={index}>- {variety}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-sm ${
                                    category.active ? 'bg-green-600' : 'bg-red-600'
                                }`}>
                                    {category.active ? 'Active' : 'Inactive'}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleStartEdit(category)}
                                        className="text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        <FaEdit />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(category.id)}
                                        className="text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        <FaTrashAlt />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 pt-2 border-t border-neutral-700 text-xs text-neutral-400">
                            {category.createdBy && (
                                <p>Created by: {category.createdBy.name}</p>
                            )}
                            {category.createdAt && (
                                <p>Created: {new Date(category.createdAt).toLocaleDateString()}</p>
                            )}
                            {category.updatedBy && (
                                <p>Last updated by: {category.updatedBy.name}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
        </RouteGuard>
    );
}