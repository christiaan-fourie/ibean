'use client';

import { useState, useEffect } from 'react';
import db from '../../utils/firebase'; 
import { collection, getDocs } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

import DOMPurify from 'isomorphic-dompurify';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

export default function DashboardHome() {
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [storeData, setStoreData] = useState(null);
  const [staffAuth, setStaffAuth] = useState(null);

  // Add staff auth check
  useEffect(() => {
    const auth = localStorage.getItem('staffAuth');
    if (auth) {
      setStaffAuth(JSON.parse(auth));
    }
  }, []);

  // Fetch store data on component mount
  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        const salesData = [];
        const productsData = [];
        const specialsData = [];
        const staffData = [];
        const refundData = [];
        const voucherData = [];

        // Fetch sales
        const salesSnapshot = await getDocs(collection(db, 'sales'));
        salesSnapshot.forEach(doc => salesData.push({ id: doc.id, ...doc.data() }));

        // Fetch products
        const productsSnapshot = await getDocs(collection(db, 'products'));
        productsSnapshot.forEach(doc => productsData.push({ id: doc.id, ...doc.data() }));

        // Fetch specials
        const specialsSnapshot = await getDocs(collection(db, 'specials'));
        specialsSnapshot.forEach(doc => specialsData.push({ id: doc.id, ...doc.data() }));

        // Fetch staff
        const staffSnapshot = await getDocs(collection(db, 'staff'));
        staffSnapshot.forEach(doc => staffData.push({ id: doc.id, ...doc.data() }));

        // Fetch refunds
        const refundsSnapshot = await getDocs(collection(db, 'refunds'));
        refundsSnapshot.forEach(doc => refundData.push({ id: doc.id, ...doc.data() }));

        // Fetch vouchers
        const vouchersSnapshot = await getDocs(collection(db, 'vouchers'));
        vouchersSnapshot.forEach(doc => voucherData.push({ id: doc.id, ...doc.data() }));
        

        setStoreData({ sales: salesData, products: productsData, specials: specialsData, staff: staffData, vouchers: voucherData, refunds: refundData });
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
      
      // Enhanced context with staff information
      const context = `You are an AI assistant for the Chilzone coffee shop's dashboard POS system (called iBean). Located in South Africa Using Rand (R).
      You are currently helping ${staffAuth.staffName} who is a ${staffAuth.accountType}.

      ${staffAuth.accountType === 'manager' 
        ? 'As a manager, they have full access to all store data and management functions.'
        : 'As a staff member, they focus mainly on sales and basic store operations.'}

      Current store data:
      Products: ${JSON.stringify(storeData.products)}
      Sales: ${JSON.stringify(storeData.sales)}
      Specials: ${JSON.stringify(storeData.specials)}
      Staff: ${JSON.stringify(storeData.staff)}
      Vouchers: ${JSON.stringify(storeData.vouchers)}
      Refunds: ${JSON.stringify(storeData.refunds)}

      Current date: ${new Date().toLocaleDateString()}

      Please provide rich, formatted responses using HTML and inline styles. You can use:

      Tables:
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <thead style="background-color: #1f2937;">
          <tr>
            <th style="padding: 8px; border: 1px solid #374151; color: #ffffff;">Header 1</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #111827;">
            <td style="padding: 8px; border: 1px solid #374151;">Data 1</td>
          </tr>
        </tbody>
      </table>

      Styled Elements:
      - <div style="background-color: #1f2937; padding: 10px; border-radius: 5px; margin: 10px 0;">Boxes</div>
      - <span style="color: #10b981;">Success Text</span>
      - <span style="color: #ef4444;">Error Text</span>
      - <span style="color: #f59e0b;">Warning Text</span>
      - <span style="font-size: 1.25em; font-weight: bold;">Large Bold Text</span>

      Lists:
      <ul style="list-style-type: none; padding: 0;">
        <li style="margin: 5px 0; padding: 5px; background-color: #1f2937; border-radius: 3px;">✓ List Item</li>
      </ul>

      Stats:
      <div style="display: flex; gap: 10px; justify-content: space-between; margin: 10px 0;">
        <div style="background-color: #1f2937; padding: 10px; border-radius: 5px; flex: 1; text-align: center;">
          <div style="font-size: 1.5em; font-weight: bold;">100</div>
          <div style="color: #9ca3af;">Label</div>
        </div>
      </div>

      Format data appropriately based on the context and make it visually appealing.

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

  // Add role-specific greeting
  useEffect(() => {
    if (staffAuth && messages.length === 0) {
      const greeting = {
        role: 'assistant',
        content: `Welcome ${staffAuth.staffName}! ${
          staffAuth.accountType === 'manager' 
            ? 'I can help you with store management, analysis, and operations.' 
            : 'I can help you with sales information and daily operations.'
        } What would you like to know?`
      };
      setMessages([greeting]);
    }
  }, [staffAuth]);

  const sanitizeHtml = (html) => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'b', 'i', 'em', 'strong', 'u', 'br', 'ul', 'ol', 'li', 
        'span', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'div',
        'h1', 'h2', 'h3', 'h4', 'hr', 'code', 'pre'
      ],
      ALLOWED_STYLES: {
        '*': {
          'color': [/^#([a-f0-9]{3}|[a-f0-9]{6})$/i, /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/, /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, ([0-1](\.\d+)?)\)$/],
          'background-color': [/^#([a-f0-9]{3}|[a-f0-9]{6})$/i, /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/],
          'text-align': ['left', 'right', 'center', 'justify'],
          'font-size': [/^\d+(?:px|em|rem|%)$/],
          'font-weight': ['bold', 'normal', /^\d+$/],
          'font-style': ['italic', 'normal'],
          'text-decoration': ['underline', 'line-through', 'none'],
          'margin': [/^[\d.]+(px|em|rem|%)(\s+[\d.]+(px|em|rem|%))*$/],
          'padding': [/^[\d.]+(px|em|rem|%)(\s+[\d.]+(px|em|rem|%))*$/],
          'border': [/^[\d.]+(px|em|rem)\s+\w+\s+([a-z]+|#[0-9a-f]{3,6})$/i],
          'border-radius': [/^[\d.]+(px|em|rem|%)$/],
          'width': [/^[\d.]+(px|em|rem|%)$/],
          'height': [/^[\d.]+(px|em|rem|%)$/],
          'display': ['block', 'inline-block', 'flex'],
          'gap': [/^[\d.]+(px|em|rem|%)$/],
          'flex-direction': ['row', 'column'],
          'justify-content': ['flex-start', 'flex-end', 'center', 'space-between'],
          'align-items': ['flex-start', 'flex-end', 'center']
        }
      },
      ALLOWED_ATTRIBUTES: {
        '*': ['style', 'class'],
        'table': ['border', 'cellpadding', 'cellspacing'],
        'td': ['colspan', 'rowspan', 'align'],
        'th': ['colspan', 'rowspan', 'align']
      }
    });
  };

  return (
    <div className="flex flex-col h-screen p-4 bg-neutral-900 text-neutral-100">
      
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-white">iBean Dashboard Assistant</h1>
        {staffAuth && (
          <div className="text-sm text-neutral-400">
            Logged in as: <span className="text-white font-medium">{staffAuth.staffName}</span>
            <span className="ml-2 px-2 py-1 bg-neutral-800 rounded text-xs capitalize">
              {staffAuth.accountType}
            </span>
          </div>
        )}
      </div>
      
      <div className="flex-1 bg-neutral-800 rounded-lg shadow-lg p-4 mb-4 overflow-auto border border-neutral-700">
        <div className="space-y-4">
        {messages.map((message, index) => (
            <div 
              key={index} 
              className={`p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-900 ml-auto max-w-[80%] text-neutral-100' 
                  : 'bg-neutral-700 mr-auto max-w-[100%] text-neutral-100'
              }`}
            >
              <div 
                className="prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{
                  __html: message.role === 'assistant' 
                    ? sanitizeHtml(message.content)
                    : message.content
                }}
              />
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