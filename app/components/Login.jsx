'use client'; // Required for components with hooks like useState

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Import for redirection
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../utils/firebase'; // Adjust the path to your firebase config file
import Image from 'next/image'; // Import the Image component

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);
  const router = useRouter(); // Hook for navigation

  // Check for existing lockout
  useEffect(() => {
    const storedLockout = localStorage.getItem('loginLockout');
    const storedAttempts = localStorage.getItem('loginAttempts');
    
    if (storedLockout) {
      const lockoutUntil = parseInt(storedLockout);
      if (lockoutUntil > Date.now()) {
        setLockoutTime(lockoutUntil);
      } else {
        localStorage.removeItem('loginLockout');
        localStorage.removeItem('loginAttempts');
      }
    }

    if (storedAttempts) {
      setAttempts(parseInt(storedAttempts));
    }
  }, []);

  // Timer countdown effect
  useEffect(() => {
    if (lockoutTime > Date.now()) {
      const timer = setInterval(() => {
        if (lockoutTime <= Date.now()) {
          setLockoutTime(0);
          setAttempts(0);
          localStorage.removeItem('loginLockout');
          localStorage.removeItem('loginAttempts');
          clearInterval(timer);
        } else {
          setLockoutTime(lockoutTime);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Check if locked out
    if (lockoutTime > Date.now()) {
      const remainingTime = Math.ceil((lockoutTime - Date.now()) / 1000);
      setError(`Please wait ${remainingTime} seconds before trying again.`);
      return;
    }

    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Reset attempts on successful login
      setAttempts(0);
      localStorage.removeItem('loginAttempts');
      localStorage.removeItem('loginLockout');
      router.push('/dashboard');
    } catch (err) {
      console.error('Login failed:', err);
      
      // Increment attempts
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      localStorage.setItem('loginAttempts', newAttempts.toString());

      // Check if max attempts reached
      if (newAttempts >= 3) {
        const lockoutUntil = Date.now() + (2 * 60 * 1000); // 2 minutes
        setLockoutTime(lockoutUntil);
        localStorage.setItem('loginLockout', lockoutUntil.toString());
        setError('Too many failed attempts. Please try again in 2 minutes.');
      } else {
        let errorMessage = `Login failed. ${3 - newAttempts} attempts remaining.`;
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          errorMessage = `Invalid email or password. ${3 - newAttempts} attempts remaining.`;
        } else if (err.code === 'auth/invalid-email') {
          errorMessage = 'Please enter a valid email address.';
        }
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const getRemainingTime = () => {
    const remaining = Math.ceil((lockoutTime - Date.now()) / 1000);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-neutral-100">
      <div className="pb-8">
            <Image
              src="/logo.png" // Path relative to the public directory
              alt="Your Company Logo"
              width={180} // Adjust width as needed
              height={60} // Adjust height as needed
              priority // Prioritize loading the logo
            />
          </div>
      <div className="w-full max-w-md p-8 space-y-6 bg-neutral-800 rounded-lg shadow-md">
        
        <div className='flex items-center justify-around'>
          <h2 className="text-2xl font-bold font-thin text-center bg-neutral-900 py-3 px-8 rounded-full text-neutral-100"> Store Login</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-neutral-300 mb-1"
            >
              Email:
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || lockoutTime > Date.now()}
              className="block w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md shadow-sm placeholder-neutral-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-neutral-100 disabled:opacity-70"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-neutral-300 mb-1"
            >
              Password:
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading || lockoutTime > Date.now()}
              className="block w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md shadow-sm placeholder-neutral-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-neutral-100 disabled:opacity-70"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div className="text-sm text-red-500 text-center">
              {error}
              {lockoutTime > Date.now() && (
                <div className="mt-2 font-medium">
                  Time remaining: {getRemainingTime()}
                </div>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || lockoutTime > Date.now()}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : lockoutTime > Date.now() ? 'Locked' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
