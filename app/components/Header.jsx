// Next Image import
import Image from 'next/image';

import { FaLock } from 'react-icons/fa';
import Menu from './Menu';
import { auth } from '../../utils/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';




export default function Header() {
    const router = useRouter();
    
    const [user, setUser] = useState(null);
    const [showConfirmLogout, setShowConfirmLogout] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });

        return () => unsubscribe();
    }, []);


    return (
        <header className="flex items-center justify-between bg-neutral-800 p-4 shadow-md rounded-lg mb-4">
            
            <Menu />

            {/* Title */}
            <h1 className="text-2xl font-light text-white flex items-center gap-2">                
                <Image src="/logo.png" alt="Logo" width={130} height={50} />
            </h1>

            {/* Login/Logout Button */}
            <button 
                className="flex items-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                onClick={() => {
                    setShowConfirmLogout(true)
                }}
            >   
                {/* Display the username if the user is logged in */}
                {user && (
                    <span className="text-white">{user.email}</span>
                )}

                <FaLock className="" />

            </button>

            {showConfirmLogout && 
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-neutral-800 p-8 rounded-lg shadow-lg">
                        <h1 className="text-2xl font-bold mb-4">Are you sure you want to logout?</h1>
                    <button 
                        className="bg-red-600 mr-4 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                        onClick={() => {
                            signOut(auth);
                            router.push('/');
                        }}>Logout</button>
                        {/* Cancel button */}
                        <button 
                            className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                            onClick={() => setShowConfirmLogout(false)}
                        >Cancel</button>
                    </div>
                </div>
            }
        </header>
    );
}