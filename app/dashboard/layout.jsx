'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../utils/firebase";
import db from "../../utils/firebase";
import { collection, getDocs } from 'firebase/firestore';
import Login from "../components/Login";
import { AiFillHome, AiOutlineShoppingCart, AiOutlineRollback, AiOutlineAppstore, AiOutlineUnorderedList, AiOutlineStar, AiOutlineGift, AiOutlineUser, AiOutlineDownload, AiOutlineLogout } from 'react-icons/ai'
import { FaStoreAlt, FaClock, FaUserCircle } from "react-icons/fa";
import { BiMenu } from "react-icons/bi";

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
    const [currentTime, setCurrentTime] = useState(new Date());
    const pathname = usePathname();

    const menuItems = [
        { 
            name: 'Home', 
            icon: AiFillHome, 
            href: '/dashboard',
            roles: ['staff', 'manager']
        },
        { 
            name: 'Sales', 
            icon: AiOutlineShoppingCart, 
            href: '/dashboard/sales',
            roles: ['staff', 'manager']
        },
        { 
            name: 'Refunds', 
            icon: AiOutlineRollback, 
            href: '/dashboard/refunds',
            roles: ['staff' ,'manager']
        },
        { 
            name: 'Products', 
            icon: AiOutlineAppstore, 
            href: '/dashboard/products',
            roles: ['manager']
        },
        { 
            name: 'Categories', 
            icon: AiOutlineUnorderedList, 
            href: '/dashboard/categories',
            roles: ['manager']
        },
        { 
            name: 'Specials', 
            icon: AiOutlineStar, 
            href: '/dashboard/specials',
            roles: ['manager']
        },
        { 
            name: 'Vouchers', 
            icon: AiOutlineGift, 
            href: '/dashboard/vouchers',
            roles: ['manager']
        },
        { 
            name: 'Staff', 
            icon: AiOutlineUser, 
            href: '/dashboard/staff',
            roles: ['manager']
        },
        { 
            name: 'Reports', 
            icon: AiOutlineDownload, 
            href: '/dashboard/reports',
            roles: ['manager', 'staff']
        },
        { 
            name: 'Account', 
            icon: FaStoreAlt, 
            href: '/dashboard/store-account',
            roles: ['manager', 'staff']
        },
    ];

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

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
        <div className="flex h-screen bg-neutral-900">
            {/* Compact Icon Sidebar */}
            <aside className="bg-neutral-800 border-r border-neutral-700 flex flex-col w-16 shadow-lg z-10">
                <nav className="flex-1 py-2">
                    {menuItems
                        .filter(item => staffAuth && item.roles.includes(staffAuth.accountType))
                        .map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            
                            return (
                                <Link
                                    href={item.href}
                                    key={item.name}
                                    className={`group relative flex items-center justify-center p-3 mx-2 my-1 rounded-lg transition-all ${
                                        isActive 
                                            ? 'bg-indigo-600 text-white shadow-lg' 
                                            : 'text-neutral-400 hover:bg-neutral-700 hover:text-white'
                                    }`}
                                    title={item.name}
                                >
                                    <Icon className="text-xl" />
                                    
                                    {/* Tooltip on hover */}
                                    <div className="absolute left-full ml-2 px-3 py-1.5 bg-neutral-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg border border-neutral-700">
                                        {item.name}
                                        <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-neutral-900 rotate-45 border-l border-b border-neutral-700"></div>
                                    </div>
                                </Link>
                            );
                        })
                    }
                </nav>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-auto bg-neutral-900">
                {/* Top Header Bar - Sticky */}
                <header className="sticky top-0 bg-neutral-800 border-b border-neutral-700 shadow-lg z-20">
                    <div className="flex items-center justify-between px-4 py-2">
                        {/* Left: Branding */}
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-600 text-white p-2 rounded-lg">
                                <span className="text-xl font-bold">iB</span>
                            </div>
                            <div>
                                <h1 className="text-white font-bold text-lg leading-none">iBEAN</h1>
                                <p className="text-neutral-400 text-xs">POS System</p>
                            </div>
                        </div>

                        {/* Center: Current Time */}
                        <div className="hidden md:flex items-center gap-2 bg-neutral-900 px-4 py-2 rounded-lg">
                            <FaClock className="text-indigo-400" />
                            <div className="text-sm">
                                <div className="text-white font-medium">
                                    {currentTime.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="text-neutral-400 text-xs">
                                    {currentTime.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </div>
                            </div>
                        </div>

                        {/* Right: Staff Info & Actions */}
                        <div className="flex items-center gap-3">
                            {staffAuth && (
                                <div className="flex items-center gap-2 bg-neutral-900 px-3 py-2 rounded-lg">
                                    <FaUserCircle className="text-2xl text-indigo-400" />
                                    <div className="hidden sm:block">
                                        <div className="text-white text-sm font-medium">{staffAuth.staffName}</div>
                                        <div className="text-neutral-400 text-xs capitalize">{staffAuth.accountType}</div>
                                    </div>
                                </div>
                            )}
                            
                            <button
                                onClick={handleEndShift}
                                className="p-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
                                title="Switch User"
                            >
                                <AiOutlineLogout className="text-xl" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1">
                    {children}
                </main>
            </div>
        </div>
    );
}
