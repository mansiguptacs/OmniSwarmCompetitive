import type { Metadata } from "next";
import { CopilotKit } from "@copilotkit/react-core";
import "./globals.css";

export const metadata: Metadata = {
  title: "CCIE — Competitive Intelligence",
  description: "Continuous Competitive Intelligence Engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <CopilotKit runtimeUrl="/api/copilotkit" agent="ccie_agent">
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}
