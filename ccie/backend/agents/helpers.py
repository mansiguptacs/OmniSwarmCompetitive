import time
import uuid

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig

from llm.heuristic import extract_company_name, heuristic_classify, heuristic_discover
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


def classify_input(text: str) -> tuple[bool, str, str]:
    """Sync wrapper for tests; production path uses llm.client.classify_company."""
    result = heuristic_classify(text)
    return result.is_hypothetical, result.target_company, result.target_description


def discover_competitors(
    target_company: str,
    is_hypothetical: bool,
    description: str = "",
) -> list[str]:
    """Sync wrapper for tests; production path uses llm.client.discover_competitors_for_target."""
    return heuristic_discover(target_company, is_hypothetical, description).competitors


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
