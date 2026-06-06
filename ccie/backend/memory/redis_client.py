import json
import re
import time

from config import get_settings
from memory.schemas import CompanyRecord
from state import Competitor, NewsItem, ProductItem, parse_competitor


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "unknown"


class RedisMemory:
    def __init__(self, client=None):
        self._client = client

    async def _get_client(self):
        if self._client is not None:
            return self._client
        import redis.asyncio as redis

        settings = get_settings()
        self._client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._client

    def _news_key(self, session_id: str, company: str) -> str:
        return f"ccie:session:{session_id}:company:{slugify(company)}:news"

    def _competitors_key(self, session_id: str) -> str:
        return f"ccie:session:{session_id}:competitors"

    def _company_key(self, session_id: str) -> str:
        return f"ccie:session:{session_id}:company"

    def _products_key(self, session_id: str, company: str) -> str:
        return f"ccie:session:{session_id}:company:{slugify(company)}:products"

    async def ping(self) -> dict:
        started = time.perf_counter()
        try:
            client = await self._get_client()
            pong = await client.ping()
            latency_ms = round((time.perf_counter() - started) * 1000, 2)
            return {"connected": bool(pong), "latency_ms": latency_ms}
        except Exception as exc:
            return {"connected": False, "latency_ms": None, "error": str(exc)}

    async def save_news(
        self,
        session_id: str,
        competitor: str,
        items: list[NewsItem],
    ) -> None:
        client = await self._get_client()
        payload = [item.model_dump() for item in items]
        await client.set(self._news_key(session_id, competitor), json.dumps(payload))

    async def get_news(self, session_id: str, competitor: str) -> list[NewsItem]:
        client = await self._get_client()
        raw = await client.get(self._news_key(session_id, competitor))
        if not raw:
            return []
        data = json.loads(raw)
        return [NewsItem.model_validate(item) for item in data]

    async def save_competitors(
        self,
        session_id: str,
        competitors: list[Competitor],
    ) -> None:
        client = await self._get_client()
        payload = [competitor.model_dump() for competitor in competitors]
        await client.set(self._competitors_key(session_id), json.dumps(payload))

    async def get_competitors(self, session_id: str) -> list[Competitor]:
        client = await self._get_client()
        raw = await client.get(self._competitors_key(session_id))
        if not raw:
            return []
        data = json.loads(raw)
        return [parse_competitor(item) for item in data]

    async def save_company(self, session_id: str, company: CompanyRecord) -> None:
        client = await self._get_client()
        payload = company.model_copy(update={"session_id": session_id}).model_dump()
        await client.set(self._company_key(session_id), json.dumps(payload))

    async def get_company(self, session_id: str) -> CompanyRecord | None:
        client = await self._get_client()
        raw = await client.get(self._company_key(session_id))
        if not raw:
            return None
        return CompanyRecord.model_validate(json.loads(raw))

    async def save_products(
        self,
        session_id: str,
        company: str,
        items: list[ProductItem],
    ) -> None:
        client = await self._get_client()
        payload = [item.model_dump() for item in items]
        await client.set(self._products_key(session_id, company), json.dumps(payload))

    async def get_products(self, session_id: str, company: str) -> list[ProductItem]:
        client = await self._get_client()
        raw = await client.get(self._products_key(session_id, company))
        if not raw:
            return []
        data = json.loads(raw)
        return [ProductItem.model_validate(item) for item in data]

    async def has_session(self, session_id: str) -> bool:
        client = await self._get_client()
        return bool(await client.exists(self._competitors_key(session_id)))
