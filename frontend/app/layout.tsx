import type { Metadata } from "next";
import { CopilotKit } from "@copilotkit/react-core";
import "./globals.css";

export const metadata: Metadata = {
  title: "CCIE — Competitive War Room",
  description:
    "Continuous Competitive Intelligence Engine — a live 3D map of your competitive landscape.",
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
