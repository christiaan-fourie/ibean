
import "./globals.css";

import { StoreProvider } from "./context/StoreContext";

import { 
  AiFillHome, 
  AiOutlineShoppingCart,
  AiOutlineRollback,
  AiOutlineAppstore,
  AiOutlineUnorderedList,
  AiOutlineUser,
  AiOutlineStar,
  AiOutlineGift,
  AiOutlineMenu,
} from 'react-icons/ai'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider> {/* Wrap your application content */}
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
