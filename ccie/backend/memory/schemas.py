from pydantic import BaseModel, Field

from state import NewsItem


class CompanyRecord(BaseModel):
    name: str
    description: str = ""
    is_hypothetical: bool = False
    analyzed_at: str = ""


class StoredNewsItem(NewsItem):
    company: str = ""
    competitor: str = ""
    session_id: str = ""
