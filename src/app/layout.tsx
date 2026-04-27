import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PwaBootstrap } from "@/components/PwaBootstrap";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const themeBootstrapScript = `
(function() {
  try {
    var themeMode = window.localStorage.getItem("omni-theme-mode");
    document.documentElement.classList.toggle("dark", themeMode === "night");
    document.documentElement.style.colorScheme = themeMode === "night" ? "dark" : "light";
  } catch (error) {
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

export const metadata: Metadata = {
  applicationName: "OmniHarness",
  title: "OmniHarness",
  description: "Supervised Multi-Agent CLI Coding Orchestrator",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "OmniHarness",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#2f6652",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="omni-theme-bootstrap"
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <PwaBootstrap />
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
