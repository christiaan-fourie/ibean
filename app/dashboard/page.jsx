'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import db from '../../utils/firebase'; 
import { collection, getDocs } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FaTrashAlt } from 'react-icons/fa';
import { FaGem } from 'react-icons/fa';
import { AiFillCompass } from "react-icons/ai";

import DOMPurify from 'isomorphic-dompurify';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

export default function DashboardHome() {
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [storeData, setStoreData] = useState(null);
  const [staffAuth, setStaffAuth] = useState(null);
  const messagesContainerRef = useRef(null);

  // Add staff auth check
  useEffect(() => {
    const auth = localStorage.getItem('staffAuth');
    if (auth) {
      setStaffAuth(JSON.parse(auth));
    }
  }, []);

  // Auto-scroll when messages update
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

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

  const handleSendMessage = async (e, predefinedType) => {
    // If e is an event (from form submission), prevent default behavior
    if (e && typeof e === 'object' && e.preventDefault) {
      e.preventDefault();
    }
    
    // Handle predefined messages or user input
    let messageContent = '';
    
    if (predefinedType) {
      // Set predefined messages based on type and staff role
      const isManager = staffAuth && staffAuth.accountType === 'manager';
      
      switch(predefinedType) {
        case 'howTo':
          isManager   
            ? messageContent = 'What administrative tasks can I perform in the iBean system?' 
            : messageContent = 'How do I use the iBean POS system for daily operations?';
          break;
        case 'sales':
          isManager 
            ? messageContent = 'Give me a sales analysis for this week. What are the trends?' 
            : messageContent = 'How is my sales performance looking? Any tips to improve?';
          break;
        case 'products':
          isManager 
            ? messageContent = 'Which products should we consider adding or removing based on sales data?' 
            : messageContent = 'What are our most popular products right now?';
          break;
        case 'coffee':
          isManager 
            ? messageContent = 'What coffee trends should we consider for our menu?' 
            : messageContent = 'What\'s the proper way to make our signature coffee drinks?';
          break;
        case 'customers':
          isManager 
            ? messageContent = 'What customer behavior patterns do you see in our data?' 
            : messageContent = 'How can I provide better customer service?';
          break;
        case 'specials':
          isManager 
            ? messageContent = 'What specials should we run based on inventory and sales data?' 
            : messageContent = 'What are today\'s specials that I should promote?';
          break;
        case 'vouchers':
          isManager 
            ? messageContent = 'How effective are our current voucher promotions? Should we adjust any?' 
            : messageContent = 'How do I verify and redeem customer vouchers?';
          break;
        case 'troubleshoot':
          isManager 
            ? messageContent = 'What system issues have been reported recently?' 
            : messageContent = 'I\'m having trouble with the system. Can you help?';
          break;
        default:
          messageContent = 'Help me understand how to use this feature.';
      }
    } else {
      // Use user input from the text field
      if (!userInput.trim() || !storeData) return;
      messageContent = userInput;
    }

    const newMessage = { role: 'user', content: messageContent };
    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);
    
    // Clear input field if this was a user-typed message
    if (!predefinedType) {
      setUserInput('');
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      // Enhanced context with staff information
      const context = `You are an AI assistant for the Chilzone coffee shop's dashboard POS system (called iBean). 
      You are currently helping ${staffAuth.staffName} who is a ${staffAuth.accountType}.

      A bit more insight into the store:
      Chillzone is a coffee shop inside a printing shops called iClick Business Centre.
      iClick Business Centre is a printing shop that offers a wide range of printing services, including business cards, flyers, brochures, and more.
      Chillzone is a coffee shop that offers a variety of beverages and snacks, including coffee, tea, pastries, and light meals.
      Both is under the same management and are located in the same building.
      It's based in South Africa, and uses the South African Rand (ZAR) as its currency.

      Our Conversation so far: ${messages.map(msg => `<p><strong>${msg.role === 'user' ? 'User' : 'Assistant'}:</strong> ${msg.content}</p>`).join('')}

      ${staffAuth.accountType === 'manager' 
        ? 'As a manager, they have full access to all store data and management functions.'
        : 'As a staff member, they focus mainly on sales and basic store operations.'}

      Current store data:
      Products: ${JSON.stringify(storeData.products)}
      Sales: ${JSON.stringify(storeData.sales)}
      Specials: ${JSON.stringify(storeData.specials)}
      Staff: ${JSON.stringify(storeData.staff)} - Please don't share the staff's codes
      Vouchers: ${JSON.stringify(storeData.vouchers)}
      Refunds: ${JSON.stringify(storeData.refunds)}

      Current date: ${new Date().toLocaleDateString()}

      Details for People:

      1. Candice (Business Owner) - Nickname: Candi
      2. Christiaan (Manager at Zevenwaght Mall Branch) & (Developer of iBean POS System)
      3. Nico (Manager at Westgate Mall Branch)

      Please provide rich, formatted responses using HTML and inline styles - Modern, Cool & Dark. You can use:

      Tables:
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <thead style="background-color: #0a0a0a;">
          <tr>
            <th style="padding: 8px; border: 1px solid #0a0a0a; color: #ffffff;">Header 1</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #0a0a0a;">
            <td style="padding: 8px; border: 1px solid #0a0a0a; color: #ffffff;">Data 1</td>
          </tr>
          <tr style="background-color: #0a0a0a;">Data 1</td>
          </tr>
        </tbody>
      </table>

      Styled Elements:
      - <div style="background-color: #0a0a0a; padding: 10px; border-radius: 5px; margin: 10px 0;">Boxes</div>
      - <span style="color: #00c951;">Success Text</span>
      - <span style="color: #ef4444;">Error Text</span>
      - <span style="color: #f59e0b;">Warning Text</span>
      - <span style="font-size: 1.25em; font-weight: bold;">Large Bold Text</span>

      Lists:
      <ul style="list-style-type: none; padding: 0;">
        <li style="margin: 5px 0; padding: 5px; background-color: #0a0a0a; border-radius: 3px;">✓ List Item</li>
      </ul>

      Stats:
      <div style="display: flex; gap: 10px; justify-content: space-between; margin: 10px 0;">
        <div style="background-color: #0a0a0a; padding: 10px; border-radius: 5px; flex: 1; text-align: center;">
          <div style="font-size: 1.5em; font-weight: bold;">100</div>
          <div style="color: #9ca3af;">Label</div>
        </div>
      </div>

      Format data appropriately based on the context and make it Modern, Cool & Dark.

      Additional Note: The App is still in development and being polished. So help me out some features are not complete.
      
      Incomplete Features:
      - Everything on the list finished now.
      - Might Add more features in the future.

      Sometimes the user might ask how to go about doing certain things in the app. Please give a step by step guide on how to do it. Use lists and tables to format the information.

      App layout:
      Side Menu (On The Left - collapsable) - The Displayed Page (on the right)
      
       Homepage(You are here to assist staff)
       Sales(Main Page of the Sales inputs (Order Summary on the right and products on the left)) Has sorting and search features
       Refunds
       Products Management
       Categories Management
       Specials Management
       Voucher Management
       Staff Management
       Exports Page
       Store Account Page

      PS: Remember to sometimes be snarky.

      Question: ${messageContent}`;

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
    // Remove markdown code fences (```html, ```, etc.)
    let cleanedHtml = html;
    
    // Remove opening code fences (```html, ```javascript, etc.)
    cleanedHtml = cleanedHtml.replace(/```[a-zA-Z]*\s*\n/g, '');
    
    // Remove closing code fences (```)
    cleanedHtml = cleanedHtml.replace(/```\s*\n/g, '');
    cleanedHtml = cleanedHtml.replace(/```$/g, '');
    
    return DOMPurify.sanitize(cleanedHtml, {
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
    <div className="flex flex-col h-screen p-2 sm:p-4 md:p-6 bg-neutral-900 text-neutral-100">
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 bg-neutral-800 p-2 rounded-lg shadow-lg gap-2">
        <div className="flex items-center gap-3 bg-neutral-700 p-2 rounded-lg">
          <div className="flex items-center gap-3">            
            <div>
              <h1 className="text-xl md:text-2xl font-bold">iBEAN Assistant</h1>
              <p className="text-xs md:text-sm text-neutral-400">Powered by Gemini 2.0 Flash</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          {staffAuth && (
            <div className="text-xs sm:text-sm text-neutral-400 text-right">
              Logged in as: <span className="text-white font-medium">{staffAuth.staffName}</span>
              <span className="ml-2 px-2 py-1 bg-neutral-800 rounded text-xs capitalize">
                {staffAuth.accountType}
              </span>
            </div>
          )}
          <button 
                onClick={() => setMessages([])} 
                className="flex items-center gap-2 px-3 py-2 ml-4 bg-neutral-600 hover:text-red-500 border border-neutral-600 hover:border-red-500 text-white rounded-lg hover:bg-neutral-700 transition-colors duration-200"
                title="Clear Chat"
              >
                <FaTrashAlt />
                <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>
      
      <div ref={messagesContainerRef} className="flex-1 bg-neutral-800 rounded-lg shadow-lg p-4 mb-4 overflow-y-auto border border-neutral-700" style={{ scrollBehavior: 'smooth' }}>
        <div className="space-y-4">
        {messages.map((message, index) => (
            <div 
              key={index} 
              className={`flex rounded-lg ${
                message.role === 'user' 
                  ? 'justify-end' 
                  : 'justify-start'
              }`}
            >
              <div className={`p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-900 text-neutral-100' 
                  : 'bg-neutral-700 text-neutral-100'
              }`} style={{ maxWidth: '90%' }}>
                <div 
                  className="prose prose-invert max-w-none overflow-x-auto"
                  dangerouslySetInnerHTML={{
                    __html: message.role === 'assistant' 
                      ? sanitizeHtml(message.content)
                      : message.content
                  }}
                />
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="bg-neutral-700 rounded-lg p-3 mr-auto text-neutral-100" style={{ maxWidth: '90%' }}>
              <div className="flex items-center space-x-2">
                <div className="animate-pulse">Thinking</div>
                <div className="animate-bounce">...</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={(e) => handleSendMessage(e)} className="flex gap-2">
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