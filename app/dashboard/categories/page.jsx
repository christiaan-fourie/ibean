'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { FaTrashAlt, FaEdit, FaCheckCircle, FaExclamationCircle, FaPlus, FaTools, FaExclamationTriangle } from 'react-icons/fa';
import db from '../../../utils/firebase';
import { getAuth } from 'firebase/auth';
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

// New Data Auditing Component for Categories
const CategoryDataAuditor = ({ categories, onStartEdit, showNotification }) => {
    const [issues, setIssues] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    const runAudit = () => {
        setIsScanning(true);
        const foundIssues = [];

        categories.forEach(category => {
            const categoryIssues = [];
            // 1. Check for missing or invalid fields
            if (!category.name || typeof category.name !== 'string') {
                categoryIssues.push({ type: 'INVALID_NAME', message: `Category name is missing or not a string.` });
            }
            if (typeof category.active !== 'boolean') {
                categoryIssues.push({ type: 'INVALID_ACTIVE_FLAG', message: `'active' flag is not a boolean.` });
            }
            if (!Array.isArray(category.varieties)) {
                categoryIssues.push({ type: 'INVALID_VARIETIES', message: `'varieties' is not an array.` });
            }
            if (typeof category.order !== 'number') {
                categoryIssues.push({ type: 'INVALID_ORDER', message: `'order' is not a number.` });
            }
            if (!category.createdAt) {
                categoryIssues.push({ type: 'MISSING_CREATED_AT', message: `Category is missing creation date.` });
            }

            if (categoryIssues.length > 0) {
                foundIssues.push({ ...category, issues: categoryIssues });
            }
        });

        setIssues(foundIssues);
        setIsScanning(false);
        showNotification(`Audit complete. Found ${foundIssues.length} categories with issues.`, 'success');
    };

    const handleFixIssue = (category) => {
        // Most category issues require manual review
        showNotification('This issue requires manual correction. Loading category into editor.', 'error');
        onStartEdit(category);
    };

    return (
        <div className="mt-8 p-6 bg-neutral-800 rounded-lg border border-neutral-700">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-3"><FaTools /> Data Integrity Audit</h2>
                <button onClick={runAudit} disabled={isScanning} className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded disabled:bg-neutral-600">
                    {isScanning ? 'Scanning...' : 'Scan Categories'}
                </button>
            </div>
            <p className="text-neutral-400 mb-4 text-sm">This tool scans for data inconsistencies like incorrect types or missing fields.</p>
            
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {issues.length > 0 ? (
                    issues.map(category => (
                        <div key={category.id} className="p-4 bg-neutral-700/50 rounded-lg border border-amber-500/50">
                            <h3 className="font-bold text-white">{category.name || 'Category with no name'}</h3>
                            <ul className="list-disc list-inside mt-2 space-y-2 text-sm">
                                {category.issues.map((issue, index) => (
                                    <li key={index} className="flex justify-between items-center">
                                        <span className="text-amber-400 flex items-center gap-2"><FaExclamationTriangle /> {issue.message}</span>
                                        <button onClick={() => handleFixIssue(category)} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded">
                                            Edit Manually
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


export default function Categories() {
    const [categories, setCategories] = useState([]);
    const [staffAuth, setStaffAuth] = useState(null);
    const initialCategoryState = { name: '', description: '', active: true, varieties: [], order: 0 };
    const [newCategory, setNewCategory] = useState(initialCategoryState);
    const [varietyInput, setVarietyInput] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [notification, setNotification] = useState({ key: 0, message: '', type: '' });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const authData = localStorage.getItem('staffAuth');
        if (authData) setStaffAuth(JSON.parse(authData));

        const q = query(collection(db, 'categories'), orderBy('order'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const categoriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCategories(categoriesData);
        }, (error) => {
            showNotification('Failed to fetch categories.', 'error');
            console.error(error);
        });

        return () => unsubscribe();
    }, []);

    const showNotification = (message, type) => {
        setNotification({ key: Date.now(), message, type });
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewCategory(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleAddVariety = () => {
        if (varietyInput && !newCategory.varieties.includes(varietyInput)) {
            setNewCategory(prev => ({ ...prev, varieties: [...prev.varieties, varietyInput.trim()] }));
            setVarietyInput('');
        }
    };

    const handleRemoveVariety = (varietyToRemove) => {
        setNewCategory(prev => ({
            ...prev,
            varieties: prev.varieties.filter(v => v !== varietyToRemove)
        }));
    };

    const resetForm = () => {
        setNewCategory(initialCategoryState);
        setEditingCategoryId(null);
        setVarietyInput('');
    };

    const handleStartEdit = (category) => {
        setEditingCategoryId(category.id);
        setNewCategory({ ...initialCategoryState, ...category });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteCategory = async (categoryId) => {
        if (!confirm('Are you sure you want to delete this category? This cannot be undone.')) return;
        try {
            await deleteDoc(doc(db, 'categories', categoryId));
            showNotification('Category deleted successfully.', 'success');
        } catch (error) {
            showNotification('Failed to delete category.', 'error');
            console.error('Error deleting category:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newCategory.name) {
            showNotification('Category name is required.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const auth = getAuth();
            const now = Timestamp.now();
            const categoryData = {
                ...newCategory,
                name: newCategory.name.trim(),
                description: newCategory.description.trim(),
                storeId: auth.currentUser.uid,
                updatedAt: now,
            };

            if (editingCategoryId) {
                categoryData.updatedBy = { id: staffAuth.staffId, name: staffAuth.staffName, role: staffAuth.accountType };
                await updateDoc(doc(db, 'categories', editingCategoryId), categoryData);
                showNotification('Category updated successfully.', 'success');
            } else {
                categoryData.order = categories.length; // Add to the end
                categoryData.createdAt = now;
                categoryData.createdBy = { id: staffAuth.staffId, name: staffAuth.staffName, role: staffAuth.accountType };
                await addDoc(collection(db, 'categories'), categoryData);
                showNotification('Category added successfully.', 'success');
            }
            resetForm();
        } catch (error) {
            showNotification('Failed to save category.', 'error');
            console.error('Error saving category:', error);
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

                <h1 className="text-3xl font-bold mb-6">Categories Management</h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <form onSubmit={handleSubmit} className="p-6 bg-neutral-800 rounded-lg border border-neutral-700 space-y-4">
                            <h2 className="text-xl font-bold">{editingCategoryId ? 'Edit Category' : 'Add New Category'}</h2>
                            <input
                                type="text" name="name" value={newCategory.name} onChange={handleChange}
                                placeholder="Category Name" className="w-full p-2 bg-neutral-700 rounded" required
                            />
                            <textarea
                                name="description" value={newCategory.description} onChange={handleChange}
                                placeholder="Description" className="w-full p-2 bg-neutral-700 rounded" rows="3"
                            />
                            <div className="flex items-center gap-2">
                                <input type="checkbox" name="active" id="active" checked={newCategory.active} onChange={handleChange} className="h-4 w-4 rounded bg-neutral-700 text-indigo-600 focus:ring-indigo-500" />
                                <label htmlFor="active">Active</label>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">Pricing Varieties (e.g., Small, Large)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text" value={varietyInput} onChange={(e) => setVarietyInput(e.target.value)}
                                        placeholder="Add variety..." className="flex-grow p-2 bg-neutral-700 rounded"
                                    />
                                    <button type="button" onClick={handleAddVariety} className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded"><FaPlus /></button>

                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {newCategory.varieties.map(v => (
                                        <span key={v} className="flex items-center gap-2 px-2 py-1 bg-neutral-600 rounded-full text-sm">
                                            {v}
                                            <button type="button" onClick={() => handleRemoveVariety(v)} className="text-red-400 hover:text-red-300">&times;</button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button type="submit" disabled={isLoading} className="flex-grow p-2 bg-indigo-600 hover:bg-indigo-700 rounded disabled:bg-neutral-600">
                                    {isLoading ? 'Saving...' : (editingCategoryId ? 'Update Category' : 'Add Category')}
                                </button>
                                {editingCategoryId && (
                                    <button type="button" onClick={resetForm} className="p-2 bg-neutral-600 hover:bg-neutral-500 rounded">
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="lg:col-span-2 space-y-3">
                        {categories.map((category) => (
                            <div
                                key={category.id}
                                className={`p-4 rounded-lg flex items-center gap-4 border ${category.active ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-800/50 border-neutral-700/50'}`}
                            >
                                <div className="flex-grow">
                                    <h3 className={`text-lg font-bold ${category.active ? 'text-white' : 'text-neutral-500'}`}>{category.name}</h3>
                                    <p className="text-sm text-neutral-400">{category.description}</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {category.varieties?.map(v => <span key={v} className="px-2 py-1 bg-neutral-700 rounded-full text-xs">{v}</span>)}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => handleStartEdit(category)} className="text-blue-400 hover:text-blue-300"><FaEdit /></button>
                                    <button onClick={() => handleDeleteCategory(category.id)} className="text-red-400 hover:text-red-300"><FaTrashAlt /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-8">
                    <CategoryDataAuditor
                        categories={categories}
                        onStartEdit={handleStartEdit}
                        showNotification={showNotification}
                    />
                </div>
            </div>
        </RouteGuard>
    );
}