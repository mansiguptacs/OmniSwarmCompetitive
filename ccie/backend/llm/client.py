from langchain_core.messages import HumanMessage

from llm.factory import get_llm
from llm.heuristic import heuristic_classify, heuristic_discover
from llm.schemas import ClassifyResult, DiscoveryResult
from state import NewsItem
from tools.web_search import search_news


def _format_search_context(items: list[NewsItem]) -> str:
    if not items:
        return "No search results available."
    lines = []
    for item in items:
        lines.append(f"- {item.title}: {item.summary}")
    return "\n".join(lines)


async def classify_company(text: str) -> ClassifyResult:
    llm = get_llm()
    if llm is None:
        return heuristic_classify(text)

    structured = llm.with_structured_output(ClassifyResult)
    prompt = (
        "Classify this user input for competitive intelligence analysis.\n"
        "Determine if they named an existing company (real) or described a "
        "hypothetical startup/product idea (hypothetical).\n\n"
        f"User input:\n{text}"
    )
    try:
        result = await structured.ainvoke([HumanMessage(content=prompt)])
        if isinstance(result, ClassifyResult):
            return result
        return ClassifyResult.model_validate(result)
    except Exception:
        return heuristic_classify(text)


async def discover_competitors_for_target(
    target_company: str,
    is_hypothetical: bool,
    description: str = "",
) -> DiscoveryResult:
    search_query = (
        f"{description[:120]} competitors"
        if is_hypothetical
        else f"{target_company} competitors"
    )
    search_results = await search_news(search_query, max_results=5)

    llm = get_llm()
    if llm is None:
        return heuristic_discover(target_company, is_hypothetical, description)

    structured = llm.with_structured_output(DiscoveryResult)
    prompt = (
        "Identify the top 3-5 direct competitors for competitive intelligence analysis.\n"
        f"Target company: {target_company or 'N/A'}\n"
        f"Hypothetical: {is_hypothetical}\n"
        f"Description: {description or 'N/A'}\n\n"
        f"Web search context:\n{_format_search_context(search_results)}\n\n"
        "Return only the most relevant competitor company names."
    )
    try:
        result = await structured.ainvoke([HumanMessage(content=prompt)])
        if isinstance(result, DiscoveryResult):
            if not result.competitors:
                return heuristic_discover(target_company, is_hypothetical, description)
            return result
        parsed = DiscoveryResult.model_validate(result)
        if not parsed.competitors:
            return heuristic_discover(target_company, is_hypothetical, description)
        return parsed
    except Exception:
        return heuristic_discover(target_company, is_hypothetical, description)
