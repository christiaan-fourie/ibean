'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../utils/firebase";
import db from "../../utils/firebase";
import { collection, getDocs } from 'firebase/firestore';
import Login from "../components/Login";
import { AiFillHome, AiOutlineMenu, AiOutlineShoppingCart, AiOutlineRollback, AiOutlineAppstore, AiOutlineUnorderedList, AiOutlineStar, AiOutlineGift, AiOutlineUser, AiOutlineDownload } from 'react-icons/ai'
import { FaStoreAlt } from "react-icons/fa";

// Create a new StaffAuthModal component
const StaffAuthModal = ({ onSuccess, onError }) => {
  const [code, setCode] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const staffMember = staffSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .find(staff => staff.code === code && staff.active);
      
      if (staffMember) {
        localStorage.setItem('staffAuth', JSON.stringify({
          timestamp: Date.now(),
          staffId: staffMember.id,
          staffName: staffMember.name,
          accountType: staffMember.accountType
        }));
        onSuccess(staffMember);
      } else {
        onError('Invalid staff code');
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      onError('Error verifying code');
    }
    
    setCode('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-neutral-800 p-8 rounded-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-6">Enter Staff Code</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength="4"
            pattern="\d{4}"
            className="w-full bg-neutral-700 text-white px-4 py-2 rounded mb-4"
            placeholder="Enter 4-digit code"
            required
            autoFocus
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Start Shift
          </button>
        </form>
      </div>
    </div>
  );
};

export default function RootLayout({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [staffAuth, setStaffAuth] = useState(null);
    const [showStaffAuth, setShowStaffAuth] = useState(false);
    const [error, setError] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [selectedMenuItem, setSelectedMenuItem] = useState(null);

    const menuItems = [
        { 
            name: 'Homepage', 
            icon: <AiFillHome />, 
            href: '/dashboard',
            roles: ['staff', 'manager'] // Everyone can see homepage
        },
        { 
            name: 'Sales', 
            icon: <AiOutlineShoppingCart />, 
            href: '/dashboard/sales',
            roles: ['staff', 'manager'] // Everyone can make sales
        },
        { 
            name: 'Refunds', 
            icon: <AiOutlineRollback />, 
            href: '/dashboard/refunds',
            roles: ['staff' ,'manager'] // Only managers can process refunds
        },
        { 
            name: 'Products', 
            icon: <AiOutlineAppstore />, 
            href: '/dashboard/products',
            roles: ['manager'] // Only managers can manage products
        },
        { 
            name: 'Categories', 
            icon: <AiOutlineUnorderedList />, 
            href: '/dashboard/categories',
            roles: ['manager']
        },
        { 
            name: 'Specials', 
            icon: <AiOutlineStar />, 
            href: '/dashboard/specials',
            roles: ['manager']
        },
        { 
            name: 'Vouchers', 
            icon: <AiOutlineGift />, 
            href: '/dashboard/vouchers',
            roles: ['manager']
        },
        { 
            name: 'Staff', 
            icon: <AiOutlineUser />, 
            href: '/dashboard/staff',
            roles: ['manager']
        },
        { 
            name: 'Reports', 
            icon: <AiOutlineDownload />, 
            href: '/dashboard/reports',
            roles: ['manager']
        },
        { 
            name: 'Store Account', 
            icon: <FaStoreAlt />, 
            href: '/dashboard/store-account',
            roles: ['manager']
        },
    ];

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
            if (currentUser) {
                // Check staff authentication when store account logs in
                const storedAuth = localStorage.getItem('staffAuth');
                if (storedAuth) {
                    const auth = JSON.parse(storedAuth);
                    // Check if auth is less than 5 minute old
                    if (Date.now() - auth.timestamp < 5 * 60 * 1000) {
                        setStaffAuth(auth);
                        return;
                    }
                }
                setShowStaffAuth(true);
            }
        });

        return () => unsubscribe();
    }, []);

    const handleStaffSuccess = (staff) => {
      const staffData = {
          staffId: staff.id,
          staffName: staff.name,
          accountType: staff.accountType,
          timestamp: Date.now()
      };
      setStaffAuth(staffData);
      setShowStaffAuth(false);
      setError('');
    };

    const handleStaffError = (message) => {
        setError(message);
        setTimeout(() => setError(''), 3000);
    };

    const handleEndShift = () => {
        localStorage.removeItem('staffAuth');
        setStaffAuth(null);
        setShowStaffAuth(true);
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-neutral-100">
            Loading...
        </div>;
    }

    if (!user) {
        return <Login />;
    }

    if (showStaffAuth) {
        return (
            <div className="min-h-screen bg-neutral-900">
                <StaffAuthModal onSuccess={handleStaffSuccess} onError={handleStaffError} />
                {error && (
                    <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded">
                        {error}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <div className={`bg-neutral-800 text-white ${isSidebarOpen ? 'w-64' : 'w-14'} transition-all duration-300`}>
                <button 
                    className="p-4 w-full text-left"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                    <AiOutlineMenu className="text-2xl" />
                </button>
                
                <nav className="">
                    {/* Menu Items */}
                    {menuItems
                        .filter(item => 
                            staffAuth && item.roles.includes(staffAuth.accountType)
                        )
                        .map((item) => (
                            <Link
                                href={item.href}
                                key={item.name}
                                onClick={() => {
                                    setSelectedMenuItem(item.name)
                                }}
                                className={`flex items-center ${!isSidebarOpen ? 'justify-center': ''} p-3 w-full text-left transition-colors duration-200 ${
                                    selectedMenuItem === item.name ? 'bg-neutral-700' : 'hover:bg-neutral-700'
                                }`}
                                title={item.name}
                                aria-label={item.name}
                                aria-current={selectedMenuItem === item.name ? 'true' : 'false'}
                                role="button"
                            >
                                <span className="text-xl">{item.icon}</span>
                                {isSidebarOpen && <span className="ml-4 text-sm">{item.name}</span>}
                            </Link>
                        ))
                    }
                </nav>

                {/* Add staff info and end shift button at bottom of sidebar */}
                {staffAuth && (
                    <div className={`mt-auto p-4 border-t border-neutral-700 ${!isSidebarOpen ? 'hidden' : ''}`}>
                        <div className="flex flex-col gap-1">
                            <div className="text-sm text-neutral-400">Current Staff</div>
                            <div className="font-medium text-white">{staffAuth.staffName}</div>
                            <div className="text-xs text-neutral-400 capitalize">{staffAuth.accountType}</div>
                            <button
                                onClick={handleEndShift}
                                className="mt-2 w-full bg-neutral-700 text-white px-3 py-1 rounded text-sm hover:bg-neutral-600 transition-colors"
                            >
                                Switch User
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto">
                <main>
                    {children}
                </main>
            </div>
        </div>
    );
}
