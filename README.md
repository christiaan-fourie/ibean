# iBean POS and Management System

A modern, web-based POS and management system for iBean coffee shops, built using Next.js 16, Tailwind CSS v4, and Firebase.

## 🚀 Technology Stack

* **Frontend Framework**: Next.js 16 (App Router) & React 19
* **Styling**: Tailwind CSS v4 (with custom animations and utility classes)
* **Database & Auth**: Cloud Firestore & Firebase Authentication (Firebase JS SDK 12.x)
* **Report Compilation**: `@react-pdf/renderer` & `jspdf`
* **AI Intelligence**: `@google/generative-ai` (Gemini API)

## 📋 Features

* **Point of Sale (POS)**: Dynamic cart, payment calculation, order checkout, and custom receipt compilation.
* **Sales Analytics & Reporting**: Sales trend analysis, financial summaries, PDF statement generation, and AI-driven recommendations.
* **Customer Vouchers**: Track, issue, and redeem customer loyalty coupons and store vouchers.
* **Staff Shift Management**: Shift-based sign-in via 4-digit codes, security roles (Staff vs. Manager), and activity tracking.
* **Product Catalog**: Manager interface for category definitions, inventory adjustments, and discount rule configurations.

For full architecture, data models, and security details, see [ibean_architecture_and_docs.md](./ibean_architecture_and_docs.md).

---

## 🔧 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/beanthere/ibean.git
cd ibean
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Instead of using manual config files, create a `.env.local` file in the root of the project to configure access to Firebase and Gemini AI:

```env
# Firebase SDK Configuration
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"

# Gemini API Configuration (For reports analysis)
NEXT_PUBLIC_GEMINI_API_KEY="your-gemini-api-key"
```

### 4. Start the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to interact with the application.

---

## 🔑 Permissions & Security

The system leverages a **two-tier** authentication protocol:
1. **Device/Store Login**: Authenticates the register instance using Firebase Auth (`app/components/Login.jsx`).
2. **Staff Shift Login**: Authenticates the individual barista or manager using a 4-digit code verified against the Firestore `staff` collection. Managers gain full access to catalog controls, user accounts, and financial reports, whereas Baristas have access to sales register features.
