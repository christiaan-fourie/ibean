'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../utils/firebase";
import Login from "../components/Login";
import { AiFillHome, AiOutlineMenu, AiOutlineShoppingCart, AiOutlineRollback, AiOutlineAppstore, AiOutlineUnorderedList, AiOutlineStar, AiOutlineGift, AiOutlineUser, AiOutlineDownload } from 'react-icons/ai'


export default function RootLayout({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [selectedMenuItem, setSelectedMenuItem] = useState('Homepage')
    const [isOrderSummaryOpen, setIsOrderSummaryOpen] = useState(false)

    const menuItems = [
        { name: 'Homepage', icon: <AiFillHome />, href: '/dashboard' },
        { name: 'Sales', icon: <AiOutlineShoppingCart />, href: '/dashboard/sales' },
        { name: 'Refunds', icon: <AiOutlineRollback />, href: '/dashboard/refunds' },
        { name: 'Products', icon: <AiOutlineAppstore />, href: '/dashboard/products' },
        { name: 'Categories', icon: <AiOutlineUnorderedList />, href: '/dashboard/categories' },
        { name: 'Specials', icon: <AiOutlineStar />, href: '/dashboard/specials' },
        { name: 'Vouchers', icon: <AiOutlineGift />, href: '/dashboard/vouchers' },
        { name: 'Exports', icon: <AiOutlineDownload />, href: '/dashboard/exports' },
        { name: 'User Account', icon: <AiOutlineUser />, href: '/dashboard/user-account' },
    ]

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
            console.log("Auth State Changed:", currentUser ? currentUser.email : 'No user');
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-neutral-100">
                Loading...
            </div>
        );
    }

    if (!user) {
      return <Login />;
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
        
        <nav className="mt-4">
          {/* Menu Items */}
          {menuItems.map((item) => (
            <Link
              href={item.href}
              key={item.name}
              onClick={() => {
                setSelectedMenuItem(item.name)
              }}
              className={`flex items-center p-4 w-full text-left transition-colors duration-200 ${
                selectedMenuItem === item.name ? 'bg-neutral-700' : 'hover:bg-neutral-700'
              }`}
              title={item.name}
              aria-label={item.name}
              aria-current={selectedMenuItem === item.name ? 'true' : 'false'}
              role="button"
            >
              <span className="text-xl">{item.icon}</span>
              {isSidebarOpen && <span className="ml-4">{item.name}</span>}
            </Link>
          ))}
        </nav>
      </div>

      
      <div className="flex-1 overflow-auto">
        <main className="">
          {children}
        </main>
      </div>

      
    </div>
  );
}
