import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import PwaBootstrap from "@/app/components/PwaBootstrap";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FRENS Workout",
  description: "Friend-group workout tracker",
  applicationName: "FRENS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "FRENS",
    statusBarStyle: "default",
    // No per-device startup images: the media queries only covered some screen
    // sizes, so any unlisted iPhone (e.g. the 428x926 Pro Max/Plus) fell back to
    // a BLACK launch screen. Without them, iOS uses the manifest's Ivory
    // background_color for the launch screen on every device — no black, and it
    // hands straight off to the in-app Splash (which draws the crest).
  },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#F9F6EF",
  // Light-only app — declare it so iOS in dark mode doesn't paint the web view
  // black for a beat before our CSS loads (the black flash before the splash).
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  // Keep the layout resizing when the Android keyboard opens, so bottom-sheet
  // inputs (comment composer) aren't hidden behind it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexMono.variable}`}
      // Inline paper background so the very first paint (before external CSS) is
      // Ivory, not the web view's default — no black flash ahead of the splash.
      style={{ backgroundColor: "#F9F6EF", colorScheme: "light" }}
    >
      <body style={{ backgroundColor: "#F9F6EF" }}>
        {children}
        <PwaBootstrap />
      </body>
    </html>
  );
}
