'use client'; // Required for components with hooks like useState

import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; // Import for redirection
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../utils/firebase'; // Adjust the path to your firebase config file
import Image from 'next/image'; // Import the Image component

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter(); // Hook for navigation

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Handle successful login
      console.log('Login successful!');
      // Redirect to a dashboard or home page upon successful login
      router.push('/dashboard'); // Example redirection path
    } catch (err) {
      console.error('Login failed:', err);
      // Provide more user-friendly error messages if possible
      let errorMessage = 'Failed to log in. Please check your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }
      // You can add more specific error checks based on Firebase error codes
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-neutral-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-neutral-800 rounded-lg shadow-md">
        <div className='flex items-center justify-left'>
          <div className="flex justify-center">
            <Image
              src="/logo.png" // Path relative to the public directory
              alt="Your Company Logo"
              width={180} // Adjust width as needed
              height={60} // Adjust height as needed
              priority // Prioritize loading the logo
            />
          </div>
          <h2 className="text-2xl font-bold text-center">Login</h2>
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
              disabled={loading}
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
              disabled={loading}
              className="block w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md shadow-sm placeholder-neutral-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-neutral-100 disabled:opacity-70"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
