"use client";

import { useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

const CELL = 9 + 2.8;

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SFCompany {
  name: string;
  short: string;
  gx: number;
  gz: number;
  color: string;
  x: number;
  z: number;
  y: number;
}

const SF_COMPANIES_RAW = [
  { name: "Salesforce",  short: "CRM",  gx: -2, gz: -3, color: "#00A1E0" },
  { name: "Uber",        short: "UBER", gx:  3, gz: -2, color: "#276EF1" },
  { name: "Airbnb",      short: "ABNB", gx: -3, gz:  2, color: "#FF5A5F" },
  { name: "X (Twitter)", short: "X",    gx:  2, gz:  3, color: "#1DA1F2" },
  { name: "Stripe",      short: "STRP", gx: -1, gz: -4, color: "#635BFF" },
  { name: "Block",       short: "SQ",   gx:  4, gz:  1, color: "#3E4348" },
  { name: "Lyft",        short: "LYFT", gx: -4, gz: -1, color: "#FF00BF" },
  { name: "Dropbox",     short: "DBX",  gx:  1, gz: -3, color: "#0061FF" },
  { name: "GitHub",      short: "GH",   gx: -3, gz: -2, color: "#24292E" },
  { name: "Slack",       short: "WORK", gx:  3, gz:  2, color: "#4A154B" },
  { name: "Pinterest",   short: "PINS", gx: -2, gz:  4, color: "#E60023" },
  { name: "Twitch",      short: "TWCH", gx:  4, gz: -2, color: "#9146FF" },
  { name: "Coinbase",    short: "COIN", gx:  2, gz: -4, color: "#0052FF" },
  { name: "DoorDash",    short: "DASH", gx: -4, gz:  3, color: "#FF3008" },
  { name: "Notion",      short: "NTON", gx:  1, gz:  4, color: "#2B2B2B" },
  { name: "Figma",       short: "FIG",  gx: -1, gz:  3, color: "#F24E1E" },
  { name: "Databricks",  short: "DBKS", gx:  4, gz: -4, color: "#FF3621" },
  { name: "Anthropic",   short: "ANTH", gx: -3, gz: -4, color: "#D4A574" },
  { name: "OpenAI",      short: "OAI",  gx:  3, gz:  4, color: "#10A37F" },
  { name: "Instacart",   short: "CART", gx: -4, gz: -3, color: "#43B02A" },
];

const SF_COMPANIES: SFCompany[] = SF_COMPANIES_RAW.map((co) => {
  const rand = mulberry32(co.gx * 1000 + co.gz);
  const buildingH = 4 + rand() * 7;
  return { ...co, x: co.gx * CELL, z: co.gz * CELL, y: buildingH + 1.5 };
});

function SFLabel({ co, visible }: { co: SFCompany; visible: boolean }) {
  return (
    <group position={[co.x, 0, co.z]}>
      <Html
        position={[0, co.y, 0]}
        center
        zIndexRange={[1, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 10, fontWeight: 700, color: "#2c3e50",
          background: "rgba(255,255,255,0.88)",
          padding: "3px 9px",
          borderRadius: 4,
          whiteSpace: "nowrap",
          boxShadow: "0 1px 6px rgba(0,0,0,0.1)",
          borderLeft: `3px solid ${co.color}`,
          opacity: visible ? 0.85 : 0,
          transition: "opacity 0.8s ease",
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: 3,
            background: co.color,
            color: "#fff",
            fontSize: 8, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {co.name.charAt(0)}
          </span>
          {co.name}
          <span style={{
            fontSize: 8, color: "#94a3b8", fontWeight: 600,
            padding: "1px 4px", borderRadius: 3,
            background: "rgba(148,163,184,0.12)",
          }}>
            {co.short}
          </span>
        </div>
      </Html>
    </group>
  );
}

export function SFCompanyLabels({
  active,
  competitorNames,
}: {
  active: boolean;
  competitorNames: string[];
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const normalizedCompetitors = useMemo(
    () => competitorNames.map(n => n.toLowerCase().trim()),
    [competitorNames],
  );

  if (!mounted) return null;

  return (
    <group>
      {SF_COMPANIES.map((co) => {
        const isCompetitor = normalizedCompetitors.some(cn =>
          cn.includes(co.name.toLowerCase()) || co.name.toLowerCase().includes(cn)
        );
        const visible = !active || isCompetitor;
        return <SFLabel key={co.name} co={co} visible={visible} />;
      })}
    </group>
  );
}
