'use client';

import { auth } from '../../../utils/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useState, useEffect } from 'react';
import RouteGuard from '../../components/RouteGuard';

const UserAccount = () => {
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    return (
        <RouteGuard requiredRoles={['manager', 'staff']}>
            <div className="min-h-screen bg-neutral-900 p-8">
                <div className="max-w-2xl mx-auto">
                    {/* Store Profile Section */}
                    <div className="bg-neutral-800 rounded-xl p-8 shadow-lg mb-8 border border-neutral-700">
                        <h1 className="text-3xl font-bold text-white mb-6">Store Profile</h1>
                        <div className="space-y-6">
                            <div className="flex items-center space-x-4">
                                <div className="bg-blue-600 p-4 rounded-full">
                                    <span className="text-2xl text-white">
                                        {user?.email?.[0]?.toUpperCase() || '?'}
                                    </span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-white">Store Account</h2>
                                    <p className="text-neutral-400">{user?.email || 'Loading...'}</p>
                                </div>
                            </div>
                            
                            <div className="border-t border-neutral-700 pt-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Account Details</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="text-neutral-400">Last Login</div>
                                    <div className="text-white">
                                        {user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString() : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Logout Section */}
                    {!showLogoutConfirm ? (
                        <button
                            onClick={() => setShowLogoutConfirm(true)}
                            className="w-full bg-neutral-800 text-white py-3 px-6 rounded-lg 
                                hover:bg-neutral-700 transition-colors duration-200 
                                border border-neutral-700 shadow-lg"
                        >
                            Sign Out
                        </button>
                    ) : (
                        <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700 shadow-lg">
                            <h3 className="text-xl font-semibold text-white mb-4">Confirm Logout</h3>
                            <p className="text-neutral-400 mb-6">Are you sure you want to sign out?</p>
                            <div className="flex space-x-4">
                                <button
                                    onClick={handleLogout}
                                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg 
                                        hover:bg-red-700 transition-colors duration-200"
                                >
                                    Yes, Sign Out
                                </button>
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    className="flex-1 bg-neutral-700 text-white py-2 px-4 rounded-lg 
                                        hover:bg-neutral-600 transition-colors duration-200"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </RouteGuard>
    );
}

export default UserAccount;