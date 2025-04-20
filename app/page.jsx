'use client'

import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import { auth } from "../utils/firebase";
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";

export default function Home() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="flex flex-col h-screen scrollbar-hide overflow-hidden">
            {/* Check if the user is logged in */}
            { !user ? (
                <Login />
            ) : (
                <Dashboard user={user} />
            )}
        </div>
    );
}

// Editing