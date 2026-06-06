import json
import re

from config import get_settings
from state import Competitor, NewsItem, parse_competitor


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

    async def has_session(self, session_id: str) -> bool:
        client = await self._get_client()
        return bool(await client.exists(self._competitors_key(session_id)))
