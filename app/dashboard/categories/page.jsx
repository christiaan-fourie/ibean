'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { FaPlus } from 'react-icons/fa';
import db from '../../../utils/firebase';
import { getAuth } from 'firebase/auth';
import { getStoreId } from '../../../utils/storeId';
import RouteGuard from '../../components/RouteGuard';
import { useCollectionLive } from '../../hooks/useCollectionLive';
import { useAuditActor } from '../../hooks/useAuditActor';
import { useToastNotification } from '../../hooks/useToastNotification';
import ToastNotification from '../../components/ToastNotification';


export default function Categories() {
    const { data: categoriesData, error: categoriesError } = useCollectionLive('categories');
    const initialCategoryState = { name: '', description: '', active: true, varieties: [], order: 0 };
    const [newCategory, setNewCategory] = useState(initialCategoryState);
    const [varietyInput, setVarietyInput] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const { notification, notify, clearNotification } = useToastNotification();
    const categories = [...categoriesData].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const { hasAuditActor, getAuditActor } = useAuditActor();
    const isEditing = Boolean(editingCategoryId);

    useEffect(() => {
        if (categoriesError) {
            notify('Failed to fetch categories.', 'error');
            console.error(categoriesError);
        }
    }, [categoriesError, notify]);

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
        setShowDeleteConfirm(false);
    };

    const handleStartEdit = (category) => {
        setEditingCategoryId(category.id);
        setNewCategory({ ...initialCategoryState, ...category });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteCategory = async (categoryId) => {
        try {
            await deleteDoc(doc(db, 'categories', categoryId));
            notify('Category deleted successfully.', 'success');
            if (editingCategoryId === categoryId) {
                resetForm();
            }
            setShowDeleteConfirm(false);
        } catch (error) {
            notify('Failed to delete category.', 'error');
            console.error('Error deleting category:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newCategory.name) {
            notify('Category name is required.', 'error');
            return;
        }
        if (!hasAuditActor) {
            notify('Staff audit identity is missing.', 'error');
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
                storeId: getStoreId(auth.currentUser),
                updatedAt: now,
            };

            if (editingCategoryId) {
                categoryData.updatedBy = getAuditActor();
                await updateDoc(doc(db, 'categories', editingCategoryId), categoryData);
                notify('Category updated successfully.', 'success');
            } else {
                categoryData.order = categories.length; // Add to the end
                categoryData.createdAt = now;
                categoryData.createdBy = getAuditActor();
                await addDoc(collection(db, 'categories'), categoryData);
                notify('Category added successfully.', 'success');
            }
            resetForm();
        } catch (error) {
            notify('Failed to save category.', 'error');
            console.error('Error saving category:', error);
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
                    />
                )}

                <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold text-white">Categories Management</h1>
                        <p className="text-sm text-neutral-400">Manage category labels, ordering defaults, and pricing varieties.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300">
                        {categories.length} categories
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
                    <section className="min-h-0 rounded-3xl border border-white/10 bg-neutral-900/70 p-4 shadow-xl backdrop-blur-xl md:p-5">
                        <form onSubmit={handleSubmit} className="h-full min-h-0 space-y-4 overflow-y-auto pr-1 text-sm">
                            <h2 className="text-base font-semibold text-white">{isEditing ? 'Edit category' : 'Create category'}</h2>
                            <input
                                type="text" name="name" value={newCategory.name} onChange={handleChange}
                                placeholder="Category Name" className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-neutral-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25" required
                            />
                            <textarea
                                name="description" value={newCategory.description} onChange={handleChange}
                                placeholder="Description" className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-neutral-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25" rows="3"
                            />
                            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                <input type="checkbox" name="active" id="active" checked={newCategory.active} onChange={handleChange} className="h-4 w-4 rounded border-white/20 bg-neutral-800 text-blue-500 focus:ring-blue-500" />
                                <label htmlFor="active" className="text-sm text-neutral-300">Active</label>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <label className="block text-sm font-medium text-neutral-300 mb-2">Pricing Varieties (e.g., Small, Large)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text" value={varietyInput} onChange={(e) => setVarietyInput(e.target.value)}
                                        placeholder="Add variety..." className="flex-grow rounded-xl border border-white/10 bg-neutral-900/70 p-2 text-white placeholder-neutral-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                                    />
                                    <button type="button" onClick={handleAddVariety} className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-white hover:bg-blue-600"><FaPlus /></button>

                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {newCategory.varieties.map((v) => (
                                        <span key={v} className="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/70 px-2 py-1 text-sm">
                                            {v}
                                            <button type="button" onClick={() => handleRemoveVariety(v)} className="text-red-400 hover:text-red-300">&times;</button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-2">
                                <button type="submit" disabled={isLoading} className="min-h-11 flex-grow rounded-2xl bg-blue-500 px-4 text-sm font-semibold text-white hover:bg-blue-600 disabled:bg-neutral-600">
                                    {isLoading ? 'Saving...' : (isEditing ? 'Save changes' : 'Create category')}
                                </button>
                                {isEditing && (
                                    <button type="button" onClick={resetForm} className="min-h-11 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15">
                                        Cancel
                                    </button>
                                )}
                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="min-h-11 rounded-2xl border border-red-400/40 bg-red-500/15 px-4 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/25"
                                    >
                                        Delete Category
                                    </button>
                                )}
                            </div>
                        </form>
                    </section>

                    <section className="min-h-0 rounded-3xl border border-white/10 bg-neutral-900/70 p-4 shadow-xl backdrop-blur-xl md:p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-white">Category List</h2>
                            <p className="text-xs text-neutral-400">Tap edit to load into the left pane.</p>
                        </div>
                        <div className="h-[calc(100%-2.5rem)] min-h-0 space-y-2.5 overflow-y-auto pr-1">
                        {categories.map((category) => (
                            <div
                                key={category.id}
                                className={`rounded-2xl border p-4 ${category.active ? 'border-white/10 bg-neutral-900/75' : 'border-white/5 bg-neutral-900/45'}`}
                            >
                                <div className="flex-grow min-w-0">
                                    <h3 className={`text-lg font-bold ${category.active ? 'text-white' : 'text-neutral-500'}`}>{category.name}</h3>
                                    <p className="text-sm text-neutral-400">{category.description || 'No description'}</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {category.varieties?.map((v) => <span key={v} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs">{v}</span>)}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleStartEdit(category)} className="min-h-8 rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-blue-300 hover:bg-white/15">Edit</button>
                                </div>
                            </div>
                        ))}
                        </div>
                    </section>
                </div>

                {showDeleteConfirm && editingCategoryId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900/95 p-5 shadow-2xl">
                            <h3 className="text-lg font-semibold text-white">Delete Category?</h3>
                            <p className="mt-2 text-sm text-neutral-300">
                                This will permanently remove <span className="font-semibold text-white">{newCategory.name || 'this category'}</span>.
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
                                    onClick={() => handleDeleteCategory(editingCategoryId)}
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
