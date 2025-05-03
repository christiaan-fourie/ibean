'use client';

import { auth } from '../../../utils/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const UserAccount = () => {
    return (
        <div className="bg-neutral-800 p-6 flex flex-col justify-center items-center w-full h-screen">
            <h1 className="text-xl font-semibold mb-4 text-center text-white">Logout?</h1>
            <p className="text-sm text-neutral-300 text-center mb-6">Are you sure you want to logout?</p>
            <div className="flex justify-center gap-4">
                <button
                    className="bg-red-600 text-white py-1.5 px-4 text-sm rounded-md hover:bg-red-700 transition-colors w-full"
                    onClick={() => {
                        signOut(auth);
                    }}>Logout
                </button>
            </div>
        </div>
    );
}

export default UserAccount;