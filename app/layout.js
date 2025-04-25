
import "./globals.css";

import { StoreProvider } from "./context/StoreContext";

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
