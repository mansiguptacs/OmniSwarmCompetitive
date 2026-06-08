from typing import Annotated, Literal, TypedDict

from copilotkit import CopilotKitState
from pydantic import BaseModel, Field


def merge_competitors_by_name(existing: list[dict], incoming: list[dict]) -> list[dict]:
    if not incoming:
        return []
    merged = {c.get("name", ""): dict(c) for c in existing if c.get("name")}
    for item in incoming:
        name = item.get("name", "")
        if not name:
            continue
        if name in merged:
            merged[name] = {**merged[name], **item}
        else:
            merged[name] = dict(item)
    return list(merged.values())


def merge_activity(existing: list[dict], incoming: list[dict]) -> list[dict]:
    if not incoming:
        return []
    return existing + incoming


class NewsItem(BaseModel):
    title: str
    url: str = ""
    summary: str = ""
    sentiment: float = 0.0
    published_at: str = ""


class ProductItem(BaseModel):
    name: str
    description: str = ""
    pricing: str = ""


class Competitor(BaseModel):
    name: str
    description: str = ""
    threat_level: float = 0.5
    sentiment: float = 0.0
    market_size: float = 0.5
    market_overlap: float = 0.5
    status: Literal["discovering", "analyzing", "complete"] = "discovering"
    news: list[NewsItem] = Field(default_factory=list)
    products: list[ProductItem] = Field(default_factory=list)
    financials: dict = Field(default_factory=dict)
    swot: dict = Field(default_factory=dict)


class AgentActivity(BaseModel):
    agent: str
    status: str
    ts: float


Phase = Literal[
    "idle",
    "classifying",
    "discovering",
    "analyzing",
    "synthesizing",
    "complete",
]


class CCIEState(CopilotKitState, total=False):
    """Shared state between LangGraph agents and CopilotKit frontend."""

    target_company: str
    target_description: str
    is_hypothetical: bool
    competitor_name: str
    competitors: Annotated[list[dict], merge_competitors_by_name]
    landscape_summary: str
    market_quadrants: dict
    agent_activity: Annotated[list[dict], merge_activity]
    phase: Phase
    session_id: str


def default_ccie_state(**overrides) -> CCIEState:
    state: CCIEState = {
        "target_company": "",
        "target_description": "",
        "is_hypothetical": False,
        "competitors": [],
        "landscape_summary": "",
        "market_quadrants": {},
        "agent_activity": [],
        "phase": "idle",
        "session_id": "",
    }
    state.update(overrides)
    return state


def parse_competitor(data: dict | Competitor) -> Competitor:
    if isinstance(data, Competitor):
        return data
    return Competitor.model_validate(data)


def competitor_to_dict(competitor: Competitor) -> dict:
    return competitor.model_dump()


def get_competitors(state: CCIEState) -> list[Competitor]:
    return [parse_competitor(c) for c in state.get("competitors", [])]


def set_competitors(state: CCIEState, competitors: list[Competitor]) -> None:
    state["competitors"] = [competitor_to_dict(c) for c in competitors]


def append_activity(state: CCIEState, agent: str, status: str, ts: float) -> None:
    activity = AgentActivity(agent=agent, status=status, ts=ts)
    state.setdefault("agent_activity", []).append(activity.model_dump())


def find_competitor_index(state: CCIEState, name: str) -> int | None:
    for index, competitor in enumerate(state.get("competitors", [])):
        if competitor.get("name", "").lower() == name.lower():
            return index
    return None
