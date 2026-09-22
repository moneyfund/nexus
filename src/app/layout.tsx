import type { Metadata, Viewport } from "next";
import { Geist, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { NexusProvider } from "@/components/nexus-provider";
import { AppShell } from "@/components/app-shell";
import { CaptureModal } from "@/components/capture-modal";
import { FlowFocus } from "@/components/flow-focus";
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});
const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
export const metadata: Metadata = {
  title: {
    default: "NEXUS OS · Tu universo conectado",
    template: "%s · NEXUS OS",
  },
  description:
    "Tu sistema personal de inteligencia. Conecta ideas, proyectos, conocimiento y tiempo en un solo espacio.",
  applicationName: "NEXUS OS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NEXUS",
  },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#020203",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geist.variable} ${space.variable}`}>
      <body>
        <NexusProvider>
          <AppShell>{children}</AppShell>
          <CaptureModal />
          <FlowFocus />
        </NexusProvider>
      </body>
    </html>
  );
}
