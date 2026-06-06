import time
import uuid

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig

from state import CCIEState


def get_last_user_message(state: CCIEState) -> str:
    messages = state.get("messages", [])
    for message in reversed(messages):
        if isinstance(message, HumanMessage):
            content = message.content
            if isinstance(content, str):
                return content
        if isinstance(message, dict) and message.get("type") == "human":
            return str(message.get("content", ""))
    return ""


def extract_company_name(text: str) -> str:
    cleaned = text.strip()
    for prefix in ("analyze ", "research ", "study "):
        if cleaned.lower().startswith(prefix):
            cleaned = cleaned[len(prefix) :].strip()
    return cleaned.split(".")[0].split(",")[0].strip()


def classify_input(text: str) -> tuple[bool, str, str]:
    company = extract_company_name(text)
    is_hypothetical = len(text.split()) > 8 or "building" in text.lower() or "targeting" in text.lower()
    if is_hypothetical:
        return True, "", text.strip()
    return False, company, ""


REAL_COMPETITOR_MAP = {
    "stripe": ["PayPal", "Adyen", "Square"],
    "paypal": ["Stripe", "Adyen", "Square"],
}

HYPOTHETICAL_COMPETITORS = ["Kira Systems", "Luminance", "Harvey AI"]


def discover_competitors(target_company: str, is_hypothetical: bool, description: str = "") -> list[str]:
    if is_hypothetical:
        if "legal" in description.lower() or "law" in description.lower():
            return HYPOTHETICAL_COMPETITORS
        return ["Competitor A", "Competitor B", "Competitor C"]

    key = target_company.lower()
    return REAL_COMPETITOR_MAP.get(key, ["PayPal", "Adyen", "Square"])


def ensure_session_id(state: CCIEState) -> str:
    session_id = state.get("session_id") or ""
    if not session_id:
        session_id = str(uuid.uuid4())
    return session_id


def build_response_message(summary: str) -> AIMessage:
    return AIMessage(content=summary)


async def safe_emit_state(config: RunnableConfig, payload: dict) -> None:
    try:
        from copilotkit.langgraph import copilotkit_emit_state

        await copilotkit_emit_state(config, payload)
    except RuntimeError:
        pass
