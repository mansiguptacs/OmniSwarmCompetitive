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
  // Inner ring — prominent downtown companies
  { name: "Salesforce",  short: "CRM",  gx:  1, gz: -1, color: "#00A1E0" },
  { name: "OpenAI",      short: "OAI",  gx: -1, gz:  1, color: "#10A37F" },
  { name: "Stripe",      short: "STRP", gx:  1, gz:  1, color: "#635BFF" },
  { name: "Anthropic",   short: "ANTH", gx: -1, gz: -1, color: "#D4A574" },
  { name: "GitHub",      short: "GH",   gx:  0, gz: -2, color: "#24292E" },
  { name: "Uber",        short: "UBER", gx:  0, gz:  2, color: "#276EF1" },
  { name: "Airbnb",      short: "ABNB", gx: -2, gz:  0, color: "#FF5A5F" },
  { name: "Slack",       short: "WORK", gx:  2, gz:  0, color: "#4A154B" },
  // Mid ring
  { name: "X (Twitter)", short: "X",    gx:  2, gz:  3, color: "#1DA1F2" },
  { name: "Block",       short: "SQ",   gx:  3, gz:  1, color: "#3E4348" },
  { name: "Lyft",        short: "LYFT", gx: -3, gz: -1, color: "#FF00BF" },
  { name: "Dropbox",     short: "DBX",  gx:  1, gz: -3, color: "#0061FF" },
  { name: "Coinbase",    short: "COIN", gx: -2, gz: -3, color: "#0052FF" },
  { name: "DoorDash",    short: "DASH", gx: -3, gz:  2, color: "#FF3008" },
  { name: "Notion",      short: "NTON", gx:  3, gz: -2, color: "#2B2B2B" },
  { name: "Figma",       short: "FIG",  gx: -1, gz:  3, color: "#F24E1E" },
  // Outer ring
  { name: "Pinterest",   short: "PINS", gx: -2, gz:  4, color: "#E60023" },
  { name: "Twitch",      short: "TWCH", gx:  4, gz: -2, color: "#9146FF" },
  { name: "Databricks",  short: "DBKS", gx:  4, gz: -4, color: "#FF3621" },
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
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 700, color: "#1e293b",
          background: "rgba(255,255,255,0.92)",
          padding: "5px 12px",
          borderRadius: 6,
          whiteSpace: "nowrap",
          boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
          borderLeft: `3px solid ${co.color}`,
          opacity: visible ? 0.9 : 0,
          transition: "opacity 0.8s ease",
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 5,
            background: co.color,
            color: "#fff",
            fontSize: 11, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {co.name.charAt(0)}
          </span>
          {co.name}
          <span style={{
            fontSize: 10, color: "#94a3b8", fontWeight: 600,
            padding: "2px 6px", borderRadius: 4,
            background: "rgba(148,163,184,0.15)",
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
