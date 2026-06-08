"""Curated, public-knowledge persona seeds for the core-software roster.

Purpose:
- **Accuracy & distinctness offline.** With no LLM (tests / no API key), these
  seeds give each incumbent a clearly different, factually grounded persona.
- **Grounding hints for the LLM.** In production the persona builder feeds these
  as priors alongside *live* search evidence, then the model refines them.

These are well-known public facts (strategy, notable M&A, leadership). They are
deliberately concise; the live grounding layer supplies freshness and citations.
"""

from __future__ import annotations

from simulation.schemas import PersonaDraft

# Keyed by lowercase company name.
PERSONA_SEEDS: dict[str, PersonaDraft] = {
    "microsoft": PersonaDraft(
        strategy_thesis=(
            "Win enterprise via cloud (Azure) and productivity (Microsoft 365), "
            "with a commanding lead in applied AI through the OpenAI partnership and Copilot."
        ),
        ethos="Platform-and-partner ecosystem; growth-mindset culture; developer-first.",
        m_and_a_history=["LinkedIn", "GitHub", "Nuance", "Activision Blizzard"],
        financial_firepower="Very high — large cash reserves and strong recurring cloud revenue.",
        temperament="acquisitive",
        recent_moves=["Deep OpenAI investment", "Copilot across the product suite", "Azure AI buildout"],
        leadership_style="Satya Nadella — disciplined, growth-mindset, partnership-driven.",
    ),
    "apple": PersonaDraft(
        strategy_thesis=(
            "Vertically integrated premium hardware plus a high-margin services ecosystem; "
            "privacy as a differentiator; custom silicon advantage."
        ),
        ethos="Secrecy, design excellence, tight ecosystem control, privacy-forward.",
        m_and_a_history=["Beats", "many small technology tuck-ins (rarely large deals)"],
        financial_firepower="Very high — enormous cash, but conservative on large acquisitions.",
        temperament="wait_and_see",
        recent_moves=["Apple silicon expansion", "Services growth", "Cautious, deliberate AI rollout"],
        leadership_style="Tim Cook — operational, disciplined, supply-chain mastery.",
    ),
    "amazon": PersonaDraft(
        strategy_thesis=(
            "Customer obsession and long-term thinking; AWS as the profit engine funding "
            "aggressive expansion across retail, logistics, devices, and AI."
        ),
        ethos="Day-1 mentality, frugality, bias for action, relentless customer focus.",
        m_and_a_history=["Whole Foods", "MGM", "Ring", "Zoox", "Kiva"],
        financial_firepower="High — AWS cash flow funds aggressive, long-horizon bets.",
        temperament="aggressive",
        recent_moves=["Generative AI on AWS (Bedrock)", "Anthropic investment", "Logistics automation"],
        leadership_style="Andy Jassy — builder, long-term, mechanism-driven.",
    ),
    "alphabet": PersonaDraft(
        strategy_thesis=(
            "Dominate search and digital advertising while leading AI research (DeepMind/Gemini) "
            "and scaling Google Cloud."
        ),
        ethos="Research-driven, engineering-led, data and scale advantage.",
        m_and_a_history=["YouTube", "Android", "DoubleClick", "DeepMind", "Fitbit"],
        financial_firepower="Very high — dominant ad revenue funds broad R&D.",
        temperament="acquisitive",
        recent_moves=["Gemini model family", "AI in Search", "Cloud AI expansion"],
        leadership_style="Sundar Pichai — consensus-oriented, AI-first, measured.",
    ),
    "meta": PersonaDraft(
        strategy_thesis=(
            "Maximize engagement and ad revenue across the social family while making large, "
            "founder-led bets on AI and the metaverse."
        ),
        ethos="Move fast, bold long-term bets, founder-controlled decisiveness.",
        m_and_a_history=["Instagram", "WhatsApp", "Oculus"],
        financial_firepower="High — ad revenue funds heavy AI/Reality Labs spend.",
        temperament="aggressive",
        recent_moves=["Open-source Llama models", "AI assistant rollout", "Reality Labs investment"],
        leadership_style="Mark Zuckerberg — founder control, decisive, willing to pivot hard.",
    ),
    "nvidia": PersonaDraft(
        strategy_thesis=(
            "Own accelerated computing for AI: dominant GPUs plus the CUDA software moat and "
            "full-stack data-center platforms."
        ),
        ethos="Engineering-first, ecosystem/developer lock-in, fast execution.",
        m_and_a_history=["Mellanox", "attempted Arm acquisition (blocked by regulators)"],
        financial_firepower="High and rapidly growing on AI-driven data-center demand.",
        temperament="partner_first",
        recent_moves=["AI GPU platform leadership", "CUDA ecosystem expansion", "Data-center growth"],
        leadership_style="Jensen Huang — founder, visionary, relentless, long-term.",
    ),
}


def get_persona_seed(company: str) -> PersonaDraft | None:
    return PERSONA_SEEDS.get(company.strip().lower())
