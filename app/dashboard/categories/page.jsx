'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { FaEdit, FaTrashAlt } from 'react-icons/fa';
import db from '../../../utils/firebase';

export default function Categories() {
    const [categories, setCategories] = useState([]);
    const [newCategory, setNewCategory] = useState({
        name: '',
        description: '',
    });
    const [editingId, setEditingId] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

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
            description: ''
        });
        setEditingId(null);
    };

    const handleStartEdit = (category) => {
        setEditingId(category.id);
        setNewCategory({
            name: category.name,
            description: category.description
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
            if (editingId) {
                await updateDoc(doc(db, 'categories', editingId), newCategory);
                setCategories(categories.map(c => 
                    c.id === editingId ? { ...newCategory, id: editingId } : c
                ));
                setSuccessMessage('Category updated successfully');
            } else {
                const docRef = await addDoc(collection(db, 'categories'), newCategory);
                setCategories([...categories, { ...newCategory, id: docRef.id }]);
                setSuccessMessage('Category added successfully');
            }
            resetForm();
        } catch (error) {
            setErrorMessage('Failed to save category');
            console.error('Error saving category:', error);
        }
    };

    return (
        <div className="flex flex-col min-h-screen p-4 bg-neutral-900 text-neutral-50">
            <h1 className="text-3xl font-bold mb-6">Categories Management</h1>

            {/* Form Section */}
            <form onSubmit={handleSubmit} className="mb-8 p-4 bg-neutral-800 rounded-lg">
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
                <button
                    type="submit"
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
                    <div key={category.id} className="p-4 bg-neutral-800 rounded-lg">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold">{category.name}</h3>
                                <p className="text-neutral-400">{category.description}</p>
                            </div>
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
                ))}
            </div>
        </div>
    );
}