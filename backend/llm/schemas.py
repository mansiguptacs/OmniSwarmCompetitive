from pydantic import BaseModel, Field


class ClassifyResult(BaseModel):
    is_hypothetical: bool
    target_company: str = ""
    target_description: str = ""
    reasoning: str = ""


class DiscoveryResult(BaseModel):
    competitors: list[str] = Field(default_factory=list, max_length=20)
    reasoning: str = ""


class FinancialResult(BaseModel):
    revenue: str = ""
    funding_total: str = ""
    valuation: str = ""
    market_cap: str = ""
    growth_rate: str = ""
    employee_count: str = ""
    source: str = ""


class CompetitorScore(BaseModel):
    name: str
    threat_level: float = 0.5
    market_size: float = 0.5
    market_overlap: float = 0.5


class LandscapeScores(BaseModel):
    scores: list[CompetitorScore] = Field(default_factory=list)


class SwotResult(BaseModel):
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    opportunities: list[str] = Field(default_factory=list)
    threats: list[str] = Field(default_factory=list)
    executive_summary: str = ""

    def as_dict(self) -> dict:
        return {
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "opportunities": self.opportunities,
            "threats": self.threats,
        }
