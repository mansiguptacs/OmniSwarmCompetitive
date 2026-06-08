"""Index hooks — vector-index intel without LangGraph changes.

Person 1 can call these directly after agent steps, or enable AUTO_INDEX_INTEL
so MemoryService indexes automatically on save_* operations.
"""

from __future__ import annotations

import json
import logging

from state import Competitor, NewsItem, ProductItem

from memory.partitioning import cache_namespace
from memory.schemas import CompanyRecord, VectorDocument
from memory.service import MemoryService

logger = logging.getLogger(__name__)


def _doc_id(session_id: str, entity_type: str, entity_id: str, suffix: str) -> str:
    return f"{session_id}:{entity_type}:{entity_id}:{suffix}"


async def index_company_profile(
    service: MemoryService,
    session_id: str,
    company: CompanyRecord,
) -> str:
    content = f"{company.name}. {company.description}".strip()
    return await service.index_document(
        VectorDocument(
            document_id=_doc_id(session_id, "company", company.name, "profile"),
            session_id=session_id,
            entity_type="company",
            entity_id=company.name,
            content=content,
            metadata={
                "is_hypothetical": company.is_hypothetical,
                "analyzed_at": company.analyzed_at,
            },
        )
    )


async def index_competitor_profile(
    service: MemoryService,
    session_id: str,
    competitor: Competitor,
) -> str:
    content = (
        f"{competitor.name}. {competitor.description} "
        f"Threat: {competitor.threat_level}. Sentiment: {competitor.sentiment}."
    ).strip()
    return await service.index_document(
        VectorDocument(
            document_id=_doc_id(session_id, "competitor", competitor.name, "profile"),
            session_id=session_id,
            entity_type="competitor",
            entity_id=competitor.name,
            content=content,
            metadata={
                "threat_level": competitor.threat_level,
                "sentiment": competitor.sentiment,
                "status": competitor.status,
            },
        )
    )


async def index_news_items(
    service: MemoryService,
    session_id: str,
    competitor: str,
    items: list[NewsItem],
) -> list[str]:
    doc_ids: list[str] = []
    for index, item in enumerate(items):
        content = f"{item.title}. {item.summary}".strip()
        doc_id = await service.index_document(
            VectorDocument(
                document_id=_doc_id(session_id, "news", competitor, str(index)),
                session_id=session_id,
                entity_type="news",
                entity_id=competitor,
                content=content,
                metadata={
                    "url": item.url,
                    "sentiment": item.sentiment,
                    "published_at": item.published_at,
                },
            )
        )
        doc_ids.append(doc_id)
    return doc_ids


async def index_product_items(
    service: MemoryService,
    session_id: str,
    company: str,
    items: list[ProductItem],
) -> list[str]:
    doc_ids: list[str] = []
    for index, item in enumerate(items):
        content = f"{item.name}. {item.description} Pricing: {item.pricing}".strip()
        doc_id = await service.index_document(
            VectorDocument(
                document_id=_doc_id(session_id, "product", company, str(index)),
                session_id=session_id,
                entity_type="product",
                entity_id=company,
                content=content,
                metadata={"pricing": item.pricing},
            )
        )
        doc_ids.append(doc_id)
    return doc_ids


async def index_synthesis_intel(
    service: MemoryService,
    session_id: str,
    competitor: str,
    *,
    swot: dict | None = None,
    landscape_summary: str = "",
) -> list[str]:
    """Index SWOT and landscape summary for semantic synthesis queries."""
    doc_ids: list[str] = []
    if swot:
        swot_text = json.dumps(swot)
        doc_ids.append(
            await service.index_document(
                VectorDocument(
                    document_id=_doc_id(session_id, "summary", competitor, "swot"),
                    session_id=session_id,
                    entity_type="summary",
                    entity_id=competitor,
                    content=swot_text,
                    metadata={"kind": "swot"},
                )
            )
        )
    if landscape_summary:
        doc_ids.append(
            await service.index_document(
                VectorDocument(
                    document_id=_doc_id(session_id, "summary", competitor, "landscape"),
                    session_id=session_id,
                    entity_type="summary",
                    entity_id=competitor,
                    content=landscape_summary,
                    metadata={"kind": "landscape"},
                )
            )
        )
    return doc_ids


async def index_session_intel(
    service: MemoryService,
    session_id: str,
    *,
    company: CompanyRecord | None = None,
    competitors: list[Competitor] | None = None,
    news_by_competitor: dict[str, list[NewsItem]] | None = None,
    products_by_competitor: dict[str, list[ProductItem]] | None = None,
    synthesis_by_competitor: dict[str, dict] | None = None,
    landscape_summary: str = "",
) -> dict[str, list[str]]:
    """Batch index hook Person 1 can call after orchestrator completes a phase."""
    indexed: dict[str, list[str]] = {
        "company": [],
        "competitors": [],
        "news": [],
        "products": [],
        "synthesis": [],
    }

    if company:
        indexed["company"].append(await index_company_profile(service, session_id, company))

    for competitor in competitors or []:
        indexed["competitors"].append(
            await index_competitor_profile(service, session_id, competitor)
        )

    for name, items in (news_by_competitor or {}).items():
        indexed["news"].extend(
            await index_news_items(service, session_id, name, items)
        )

    for name, items in (products_by_competitor or {}).items():
        indexed["products"].extend(
            await index_product_items(service, session_id, name, items)
        )

    for name, swot in (synthesis_by_competitor or {}).items():
        indexed["synthesis"].extend(
            await index_synthesis_intel(service, session_id, name, swot=swot)
        )

    if landscape_summary:
        indexed["synthesis"].append(
            await service.index_document(
                VectorDocument(
                    document_id=_doc_id(session_id, "summary", "landscape", "global"),
                    session_id=session_id,
                    entity_type="summary",
                    entity_id="landscape",
                    content=landscape_summary,
                    metadata={"kind": "landscape"},
                )
            )
        )

    logger.info(
        "Indexed session intel session_id=%s counts=%s",
        session_id,
        {k: len(v) for k, v in indexed.items()},
    )
    return indexed


def llm_cache_namespace(session_id: str, entity_id: str | None = None) -> str:
    """Namespace for partitioned LangCache entries."""
    return cache_namespace(session_id, entity_id)
