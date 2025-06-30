'use client';

import { useState, useEffect } from 'react';
import db from '../../../utils/firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import RouteGuard from '../../components/RouteGuard';

// Toast Notification
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);
    const isSuccess = type === 'success';
    const bgColor = isSuccess ? 'bg-green-600/30 border-green-500' : 'bg-red-600/30 border-red-500';
    return (
        <div className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-lg flex items-center gap-3 text-white border ${bgColor} z-50`}>
            <span>{message}</span>
        </div>
    );
};

// Staff Modal
const StaffModal = ({ isEdit, onSubmit, onClose, initialData = {} }) => {
    const [formData, setFormData] = useState({
        name: initialData.name || '',
        code: initialData.code || '',
        dob: initialData.dob || '',
        accountType: initialData.accountType || 'staff',
        active: initialData.active ?? true
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!/^\d{4}$/.test(formData.code)) return;
        onSubmit(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-neutral-800 rounded-lg p-6 w-full max-w-md">
                <h2 className="text-2xl font-bold text-white mb-4">
                    {isEdit ? 'Edit Staff Member' : 'Add New Staff Member'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-neutral-300 mb-1">Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-neutral-700 text-white rounded p-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-neutral-300 mb-1">Login Code</label>
                        <input
                            type="password"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                            className="w-full bg-neutral-700 text-white rounded p-2"
                            required
                            maxLength={4}
                            pattern="\d{4}"
                            title="Please enter a 4-digit code"
                        />
                    </div>
                    <div>
                        <label className="block text-neutral-300 mb-1">Date of Birth</label>
                        <input
                            type="date"
                            value={formData.dob}
                            onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                            className="w-full bg-neutral-700 text-white rounded p-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-neutral-300 mb-1">Account Type</label>
                        <select
                            value={formData.accountType}
                            onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                            className="w-full bg-neutral-700 text-white rounded p-2"
                        >
                            <option value="staff">Staff</option>
                            <option value="manager">Manager</option>
                        </select>
                    </div>
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            checked={formData.active}
                            onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                            className="bg-neutral-700 rounded"
                        />
                        <label className="text-neutral-300">Active</label>
                    </div>
                    <div className="flex space-x-4">
                        <button
                            type="submit"
                            className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                        >
                            {isEdit ? 'Update' : 'Add'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-neutral-600 text-white py-2 rounded hover:bg-neutral-700"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function StaffManagement() {
    const [staff, setStaff] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [currentStaff, setCurrentStaff] = useState(null);
    const [notification, setNotification] = useState({ key: 0, message: '', type: '' });

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'staff'), (snapshot) => {
            setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setIsLoading(false);
        }, (error) => {
            setNotification({ key: Date.now(), message: 'Error fetching staff.', type: 'error' });
            setIsLoading(false);
        });
        return () => unsub();
    }, []);

    const showNotification = (message, type) => {
        setNotification({ key: Date.now(), message, type });
    };

    const handleSubmitForm = async (formData) => {
        try {
            if (currentStaff) {
                await updateDoc(doc(db, 'staff', currentStaff.id), {
                    ...formData,
                    code: formData.code.padStart(4, '0'),
                });
                showNotification('Staff updated successfully.', 'success');
            } else {
                await addDoc(collection(db, 'staff'), {
                    ...formData,
                    code: formData.code.padStart(4, '0'),
                });
                showNotification('Staff added successfully.', 'success');
            }
            setShowAddModal(false);
            setShowEditModal(false);
            setCurrentStaff(null);
        } catch (error) {
            showNotification('Error saving staff.', 'error');
        }
    };

    const handleEdit = (member) => {
        setCurrentStaff(member);
        setShowEditModal(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to delete this staff member?')) {
            try {
                await deleteDoc(doc(db, 'staff', id));
                showNotification('Staff deleted.', 'success');
            } catch (error) {
                showNotification('Error deleting staff.', 'error');
            }
        }
    };

    return (
        <RouteGuard requiredRoles={['manager']}>
            <div className="min-h-screen bg-neutral-900 p-8">
                {notification.message && (
                    <Toast
                        key={notification.key}
                        message={notification.message}
                        type={notification.type}
                        onClose={() => setNotification({ message: '', type: '' })}
                    />
                )}
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold text-white">Staff Management</h1>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        >
                            Add Staff Member
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="text-white">Loading...</div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {staff.map((member) => (
                                <div key={member.id} className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-xl font-semibold text-white">{member.name}</h3>
                                            <p className="text-neutral-400 capitalize">{member.accountType}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-sm ${
                                            member.active ? 'bg-green-600' : 'bg-red-600'
                                        }`}>
                                            {member.active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="text-neutral-300 text-sm mb-4">
                                        <p>DOB: {member.dob ? new Date(member.dob).toLocaleDateString() : 'N/A'}</p>
                                        <p>Code: ****</p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => handleEdit(member)}
                                            className="flex-1 bg-neutral-700 text-white py-2 rounded hover:bg-neutral-600"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(member.id)}
                                            className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {showAddModal && (
                        <StaffModal
                            isEdit={false}
                            onSubmit={handleSubmitForm}
                            onClose={() => setShowAddModal(false)}
                        />
                    )}
                    {showEditModal && (
                        <StaffModal
                            isEdit={true}
                            initialData={currentStaff}
                            onSubmit={handleSubmitForm}
                            onClose={() => {
                                setShowEditModal(false);
                                setCurrentStaff(null);
                            }}
                        />
                    )}
                </div>
            </div>
        </RouteGuard>
    );
}