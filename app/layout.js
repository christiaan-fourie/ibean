import "./globals.css";
import PwaRegistration from "./components/PwaRegistration";

export const metadata = {
  applicationName: "iBEAN",
  title: "iBEAN",
  description: "iBEAN tablet dashboard and point of sale",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "iBEAN",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f1115",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
