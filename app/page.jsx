'use client'

import Login from "./components/Login";
import AppLoadingScreen from "./components/AppLoadingScreen";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../utils/firebase";

export default function Home() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (user) {
            router.push('/dashboard');
        }
    }, [user, router]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
            console.log("Auth State Changed:", currentUser ? currentUser.email : 'No user');
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return <AppLoadingScreen label="Checking session" />;
    }

    return (
        <div>
            { !user ? (
                <Login />
            ) : null}
        </div>
    );
}

// Editing
