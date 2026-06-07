"use client";

import { useState } from "react";

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_COREWEAVE_DASHBOARD_URL ||
  "https://wandb.ai/mohitmanoj-barade-san-jose-state-university/StrategyOS/weave/traces?view=traces_default";

export function DashboardButton() {
  const [hover, setHover] = useState(false);

  return (
    <a
      href={DASHBOARD_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Open CoreWeave dashboard — traces & metrics"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 38,
        padding: "0 14px",
        borderRadius: 999,
        textDecoration: "none",
        background: hover ? "rgba(16,22,34,0.98)" : "rgba(10,14,23,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(99,102,241,0.4)",
        boxShadow: hover
          ? "0 10px 30px rgba(99,102,241,0.35)"
          : "0 6px 20px rgba(0,0,0,0.4)",
        color: "#c7d2fe",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.01em",
        cursor: "pointer",
        transition: "all 0.2s ease",
        transform: hover ? "translateY(-1px)" : "none",
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
      Dashboard
    </a>
  );
}
