import type { Metadata } from "next";
import "./globals.css";
import { NexusProvider } from "@/components/nexus-provider";
import { AppShell } from "@/components/app-shell";
import { CaptureModal } from "@/components/capture-modal";
import { FlowFocus } from "@/components/flow-focus";

export const metadata: Metadata = {
  title: "NEXUS · Personal OS",
  description: "Personal execution system for projects, time, goals and finance."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
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
