"""Persistence and Redis Iris Context Retriever schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field

from state import Competitor, NewsItem, ProductItem


class CompanyRecord(BaseModel):
    """Target company profile stored across sessions."""

    name: str
    description: str = ""
    is_hypothetical: bool = False
    analyzed_at: str = ""
    session_id: str = ""


class StoredNewsItem(NewsItem):
    """News item with session and entity linkage for Iris retrieval."""

    company: str = ""
    competitor: str = ""
    session_id: str = ""


class CompetitorRecord(BaseModel):
    """Competitor entity for Iris Context Retriever."""

    name: str
    description: str = ""
    threat_level: float = 0.5
    sentiment: float = 0.0
    market_size: float = 0.5
    market_overlap: float = 0.5
    status: str = "discovering"
    session_id: str = ""

    @classmethod
    def from_competitor(cls, competitor: Competitor, *, session_id: str = "") -> CompetitorRecord:
        return cls(
            name=competitor.name,
            description=competitor.description,
            threat_level=competitor.threat_level,
            sentiment=competitor.sentiment,
            market_size=competitor.market_size,
            market_overlap=competitor.market_overlap,
            status=competitor.status,
            session_id=session_id,
        )


class ProductRecord(BaseModel):
    """Product entity for Iris Context Retriever."""

    name: str
    description: str = ""
    pricing: str = ""
    company: str = ""
    session_id: str = ""

    @classmethod
    def from_product(
        cls, product: ProductItem, *, company: str = "", session_id: str = ""
    ) -> ProductRecord:
        return cls(
            name=product.name,
            description=product.description,
            pricing=product.pricing,
            company=company,
            session_id=session_id,
        )


class VectorDocument(BaseModel):
    """Indexable document for vector search (news, SWOT, summaries, etc.)."""

    document_id: str = ""
    session_id: str = ""
    entity_type: str = ""  # company | competitor | news | product | summary
    entity_id: str = ""
    content: str = ""
    metadata: dict = Field(default_factory=dict)


# Registry for future Redis Iris Context Retriever schema registration.
IRIS_SCHEMA_REGISTRY: dict[str, type[BaseModel]] = {
    "Company": CompanyRecord,
    "Competitor": CompetitorRecord,
    "NewsItem": StoredNewsItem,
    "Product": ProductRecord,
    "VectorDocument": VectorDocument,
}
