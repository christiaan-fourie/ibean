'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../utils/firebase";
import db from "../../utils/firebase";
import { collection, getDocs } from 'firebase/firestore';
import Login from "../components/Login";
import AppLoadingScreen from "../components/AppLoadingScreen";
import { DashboardSessionProvider } from "../components/DashboardSessionContext";
import { AiFillHome, AiOutlineShoppingCart, AiOutlineRollback, AiOutlineAppstore, AiOutlineUnorderedList, AiOutlineStar, AiOutlineGift, AiOutlineUser, AiOutlineDownload, AiOutlineLogout } from 'react-icons/ai'
import { FaStoreAlt, FaClock, FaUserCircle } from "react-icons/fa";
// Create a new StaffAuthModal component
const StaffAuthModal = ({ storeId, onSuccess, onError }) => {
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
          accountType: staffMember.accountType,
          storeId: storeId || null,
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
      <div className="bg-neutral-800/95 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-6">Enter Staff Code</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength="4"
            pattern="\d{4}"
            className="w-full bg-neutral-700/90 border border-white/10 text-white px-4 py-2 rounded-xl mb-4"
            placeholder="Enter 4-digit code"
            required
            autoFocus
          />
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 rounded-xl hover:bg-blue-600"
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
          storeId: user?.email || null,
          timestamp: Date.now()
      };
      localStorage.setItem('staffAuth', JSON.stringify(staffData));
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

    const sessionValue = {
        user,
        staffAuth,
        isSessionReady: !loading && !!user && !showStaffAuth,
        endShift: handleEndShift
    };

    if (loading) {
        return (
            <DashboardSessionProvider value={sessionValue}>
                <AppLoadingScreen label="Loading dashboard" />
            </DashboardSessionProvider>
        );
    }

    if (!user) {
        return (
            <DashboardSessionProvider value={sessionValue}>
                <Login />
            </DashboardSessionProvider>
        );
    }

    if (showStaffAuth) {
        return (
            <DashboardSessionProvider value={sessionValue}>
                <div className="min-h-screen bg-neutral-900">
                    <StaffAuthModal storeId={user?.email} onSuccess={handleStaffSuccess} onError={handleStaffError} />
                    {error && (
                        <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded">
                            {error}
                        </div>
                    )}
                </div>
            </DashboardSessionProvider>
        );
    }

    return (
        <DashboardSessionProvider value={sessionValue}>
        <div className="flex h-screen overflow-hidden bg-neutral-900">
            {/* Compact Icon Sidebar */}
            <aside className="bg-neutral-950/70 backdrop-blur-2xl border-r border-white/10 flex flex-col w-[68px] shadow-lg z-10">
                <div className="flex h-14 items-center justify-center border-b border-white/10">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-500 text-sm font-bold text-white shadow-lg shadow-blue-500/25">
                        iB
                    </div>
                </div>
                <nav className="flex-1 py-3">
                    {menuItems
                        .filter(item => staffAuth && item.roles.includes(staffAuth.accountType))
                        .map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            
                            return (
                                <Link
                                    href={item.href}
                                    key={item.name}
                                    className={`group relative mx-2 mb-1 flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${
                                        isActive 
                                            ? 'bg-white text-neutral-950 shadow-lg' 
                                            : 'text-neutral-400 hover:bg-white/10 hover:text-white'
                                    }`}
                                    title={item.name}
                                >
                                    {isActive && (
                                        <span className="absolute -left-2 h-6 w-1 rounded-r-full bg-blue-400" />
                                    )}
                                    <Icon className="text-xl" />
                                    
                                    {/* Tooltip on hover */}
                                    <div className="absolute left-full ml-3 px-3 py-1.5 bg-neutral-950/95 backdrop-blur-xl text-white text-sm rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg border border-white/10">
                                        {item.name}
                                        <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-neutral-950 rotate-45 border-l border-b border-white/10"></div>
                                    </div>
                                </Link>
                            );
                        })
                    }
                </nav>
            </aside>

            {/* Main Content Area */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-neutral-900">
                {/* Top Header Bar - Sticky */}
                <header className="relative z-20 flex-shrink-0 bg-neutral-950/70 backdrop-blur-2xl border-b border-white/10 shadow-lg">
                    <div className="flex h-14 items-center justify-between px-4">
                        {/* Left: Branding */}
                        <div className="flex items-center gap-3">
                            <div>
                                <h1 className="text-white font-semibold text-base leading-none">iBEAN</h1>
                                <p className="text-neutral-500 text-xs">POS System</p>
                            </div>
                        </div>

                        {/* Center: Current Time */}
                        <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl">
                            <FaClock className="text-blue-400" />
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
                        <div className="flex items-center gap-2">
                            {staffAuth && (
                                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl">
                                    <FaUserCircle className="text-xl text-blue-400" />
                                    <div className="hidden sm:block">
                                        <div className="text-white text-sm font-medium">{staffAuth.staffName}</div>
                                        <div className="text-neutral-400 text-xs capitalize">{staffAuth.accountType}</div>
                                    </div>
                                </div>
                            )}
                            
                            <button
                                onClick={handleEndShift}
                                className="flex h-10 w-10 items-center justify-center bg-white/10 hover:bg-white/15 text-white rounded-2xl border border-white/10 transition-colors"
                                title="Switch User"
                            >
                                <AiOutlineLogout className="text-xl" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="min-h-0 flex-1 overflow-hidden">
                    {children}
                </main>
            </div>
        </div>
        </DashboardSessionProvider>
    );
}
