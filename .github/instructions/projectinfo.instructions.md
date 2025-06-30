---
applyTo: '**'
---
Coding standards, domain knowledge, and preferences that AI should follow for the iBean project.

# Project Information
- **Project Name**: iBean Point of Sale (POS)
- **Framework**: Next.js (App Router)
- **Language**: JavaScript with React
- **Styling**: Tailwind CSS (Dark Mode)
- **Backend**: Firebase (Authentication and Firestore Database)
- **Deployment**: Vercel

The project is a single Point of Sale (POS) application for use by staff in a coffee shop.

# Coding Conventions & Style
- **Components**: Always use functional components with React Hooks. Interactive client-side components must start with `'use client';`.
- **Styling**: Use Tailwind CSS utility classes directly in the JSX. Avoid creating separate CSS files.
- **Naming**:
    - Components: `PascalCase` (e.g., `OrderCheckout.jsx`)
    - Variables/Functions: `camelCase` (e.g., `appliedSpecials`, `handleConfirm`)
- **Asynchronous Operations**: All interactions with Firestore must be `async/await` and wrapped in `try...catch` blocks for robust error handling.
- **Data Integrity**: When handling data from Firestore or user input, always parse it into the correct type (e.g., `parseInt`, `parseFloat`) and provide default fallback values (e.g., `|| 0`) to prevent runtime errors like `NaN`.
- **Currency**: Perform calculations with numbers and use `.toFixed(2)` only for the final display to the user to avoid floating-point precision issues.

# Authentication & Authorization
The application uses a two-layer authentication model:

1.  **Store Authentication (Device Level)**:
    -   The POS application itself logs into Firebase using a dedicated **Firebase Authentication** account (email/password).
    -   Each physical store location has its own Firebase Auth account.
    -   These accounts are created manually in the Firebase console for security and are used to authenticate the device/application instance, not the employee.

2.  **Employee Authorization (User Level)**:
    -   After the store is authenticated, employees log in using a custom **4-digit PIN**.
    -   The app validates this PIN against the `staff` collection in Firestore.
    -   Upon success, the employee's details (name, `accountType`: 'manager' or 'staff') are stored in `localStorage` to manage their session.
    -   A `RouteGuard` component uses this session data to protect manager-only routes and features within the application.

# AI Assistant Context
The dashboard features an AI assistant powered by Google's Gemini model. Its context is pre-loaded with the following information:
### Persona & Behavior
- **Identity**: An AI assistant for the "Chillzone" coffee shop's POS system, which is named "iBean".
- **Tone**: Helpful, professional, and sometimes "snarky".
- **Output Format**: Provides rich, formatted responses using HTML and inline styles for a modern, dark-mode UI.
- **Role-Awareness**: Tailors its responses based on whether the user is a 'manager' or 'staff'.
### Store Background
- **Primary Business**: "Chillzone", a coffee shop.
- **Location**: Situated inside a printing shop named "iClick Business Centre". Both are under the same management.
- **Region**: Based in South Africa, using the South African Rand (ZAR).
### Key Personnel
- **Candice (Candi)**: Business Owner.
- **Christiaan**: Manager (Zevenwaght Mall Branch) & Developer of the iBean POS.
- **Nico**: Manager (Westgate Mall Branch).
### Application Layout
- A collapsible side menu on the left and the main page content on the right.
- **Pages**: Homepage (AI Assistant), Sales, Refunds, Products Management, Categories Management, Specials Management, Voucher Management, Staff Management, Exports, Store Account.

# Data Structure
The data is stored in Firestore with the following collections:
### `products`
- **`name`** (string): The name of the product (e.g., "Cappuccino").
- **`description`** (string, optional): A brief description of the product.
- **`category`** (string): The name of the category it belongs to (e.g., "Coffee").
- **`price`** (number, optional): The price for products that have a single, standard price.
- **`varietyPrices`** (map, optional): An object mapping varieties to prices for products with multiple sizes/types (e.g., `{ "Short": 25, "Tall": 30 }`).
- **`storeId`** (string): The Firebase Auth UID of the store where the product was created.
- **`createdBy`** (map): Audit object with details of the staff member who created it (`id`, `name`, `role`).
- **`createdAt`** (timestamp): The server timestamp of creation.
- **`updatedBy`** (map, optional): Audit object for the last staff member who updated it.
- **`updatedAt`** (timestamp, optional): The server timestamp of the last update.
### `categories`
- **`name`** (string), **`description`** (string, optional), **`active`** (boolean), **`varieties`** (array of strings), **`order`** (number), **`storeId`** (string, optional), **`createdBy`** (map), **`createdAt`** (timestamp), **`updatedBy`** (map), **`updatedAt`** (timestamp)
### `specials`
- **`name`** (string), **`description`** (string), **`active`** (boolean), **`mutuallyExclusive`** (boolean), **`startDate`** / **`endDate`** (string), **`triggerType`** (string), **`triggerQuantity`** (number), **`triggerProduct`** / **`triggerCategory`** (string), **`triggerProductSize`** / **`triggerCategorySize`** (string, optional), **`rewardType`** (string), **`rewardQuantity`** (number), **`rewardProduct`** / **`rewardCategory`** (string), **`rewardProductSize`** / **`rewardCategorySize`** (string, optional), **`discountType`** (string), **`discountValue`** (number), **`fixedDiscountAmount`** (number)
### `sales`
- **`staffId`** / **`staffName`** (string), **`date`** (timestamp), **`total`** (number), **`items`** (array of maps), **`appliedSpecials`** (array of maps, optional), **`voucher`** (map, optional), **`payment`** (map)
### `refunds`
- **`productName`** (string): The name of the item being refunded.
- **`amount`** (number): The monetary value of the refund.
- **`reason`** (string): The reason for the refund.
- **`method`** (string): The method used for the refund (e.g., "cash", "card").
- **`staffName`** (string): The name of the staff member who processed the refund.
- **`date`** (timestamp): The server timestamp of when the refund occurred.
- **`storeId`** (string): The ID of the store where the refund was processed (e.g., the store's Firebase Auth email).
- **`createdBy`** (map): An audit object containing the staff member's details (`id`, `name`, `role`).
### `vouchers`
- **`name`** (string), **`code`** (string), **`active`** (boolean), **`redeemed`** (boolean), **`voucherType`** (string), **`discountType`** (string), **`discountValue`** (number), **`initialValue`** / **`currentBalance`** (number, optional), **`minimumPurchase`** (number, optional), **`applicableItems`** (array of strings, optional), **`restrictedToStores`** (array of strings, optional), **`maxRedemptions`** (number, optional), **`redemptionCount`** (number), **`expireAfterRedemption`** (boolean), **`expirationDate`** (timestamp), **`redemptionHistory`** (array of maps, optional), **`createdBy`** (map)
### `staff`
- **`name`** (string), **`code`** (string), **`dob`** (string), **`accountType`** (string), **`active`** (boolean)

# Additional Notes

If there is anything that is picked up while coding that is not covered by the above, please ask for clarification and suggest update to this file.

# Firestore Rules
```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // The default is to deny all reads and writes.
    // Rules are based on the Store's Firebase Auth UID, not the employee's PIN.
    // Employee role-based access is handled client-side.

    // An authenticated store can read data required for POS operations.
    match /products/{docId} { allow read: if request.auth != null; }
    match /categories/{docId} { allow read: if request.auth != null; }
    match /specials/{docId} { allow read: if request.auth != null; }
    
    // An authenticated store can read/query the staff list to verify PINs.
    match /staff/{staffId} {
      allow read: if request.auth != null;
    }

    // An authenticated store can read/query vouchers to validate them.
    // It can also update a voucher's balance or status upon redemption.
    match /vouchers/{voucherId} {
      allow read: if request.auth != null;
      allow update: if request.auth != null;
    }

    // An authenticated store can create new sales and refund documents.
    match /sales/{saleId} {
      allow create: if request.auth != null;
    }
    match /refunds/{refundId} {
      allow create: if request.auth != null;
    }

    // IMPORTANT: Writing to core data collections (products, staff, etc.)
    // should only be done from a trusted admin environment or a cloud function.
    // For the dashboard, manager-only write access is enforced by the client-side RouteGuard.
    // The rules below allow writes if the client is authenticated, trusting the client-side guard.
    match /products/{docId} { allow write: if request.auth != null; }
    match /categories/{docId} { allow write: if request.auth != null; }
    match /specials/{docId} { allow write: if request.auth != null; }
    match /vouchers/{voucherId} { allow create, delete: if request.auth != null; }
    match /staff/{staffId} { allow write: if request.auth != null; }
  }
}
```