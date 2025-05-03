'use client';

import { useState, useEffect } from 'react';
import db from '../../utils/firebase'; // Adjust path if needed
import { collection, getDocs } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

export default function DashboardHome() {
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [storeData, setStoreData] = useState(null);

  // Fetch store data on component mount
  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        const salesData = [];
        const productsData = [];
        const specialsData = [];

        // Fetch sales
        const salesSnapshot = await getDocs(collection(db, 'sales'));
        salesSnapshot.forEach(doc => salesData.push({ id: doc.id, ...doc.data() }));

        // Fetch products
        const productsSnapshot = await getDocs(collection(db, 'products'));
        productsSnapshot.forEach(doc => productsData.push({ id: doc.id, ...doc.data() }));

        // Fetch specials
        const specialsSnapshot = await getDocs(collection(db, 'specials'));
        specialsSnapshot.forEach(doc => specialsData.push({ id: doc.id, ...doc.data() }));

        setStoreData({ sales: salesData, products: productsData, specials: specialsData });
      } catch (error) {
        console.error('Error fetching store data:', error);
      }
    };

    fetchStoreData();
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || !storeData) return;

    const newMessage = { role: 'user', content: userInput };
    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      // Prepare context from store data
      const context = `You are a helpful AI assistant for an coffee shop called Chillzone. You are on the home page of the dashboard of a POS system. 
        The dashboard is used by the store owner to manage the store as well as the employees that work there.
        Here is the current store data:
        Products: ${JSON.stringify(storeData.products)}
        Sales: ${JSON.stringify(storeData.sales)}
        Specials: ${JSON.stringify(storeData.specials)}
        
        The current date is: ${new Date().toLocaleDateString()}.
        Please answer questions about the store data, sales trends, and product performance.
        Question: ${userInput}`;

      const result = await model.generateContent(context);
      const response = await result.response;
      const aiMessage = { role: 'assistant', content: response.text() };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request.' 
      }]);
    }

    setIsLoading(false);
    setUserInput('');
  };

  return (
    <div className="flex flex-col h-screen p-4 bg-neutral-900 text-neutral-100">
      <h1 className="text-2xl font-bold mb-4 text-white">iBean Dashboard Assistant</h1>
      
      <div className="flex-1 bg-neutral-800 rounded-lg shadow-lg p-4 mb-4 overflow-auto border border-neutral-700">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-900 ml-auto max-w-[80%] text-neutral-100' 
                  : 'bg-neutral-700 mr-auto max-w-[80%] text-neutral-100'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          ))}
          {isLoading && (
            <div className="bg-neutral-700 rounded-lg p-3 mr-auto max-w-[80%] text-neutral-100">
              <div className="flex items-center space-x-2">
                <div className="animate-pulse">Thinking</div>
                <div className="animate-bounce">...</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Ask about your store data..."
          className="flex-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 
            text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 
            focus:ring-blue-500 focus:border-transparent"
        />
        <button 
          type="submit"
          disabled={isLoading || !userInput.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg 
            disabled:bg-neutral-700 disabled:text-neutral-400 
            hover:bg-blue-700 transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Send
        </button>
      </form>
    </div>
  );
}