from pydantic import BaseModel, Field


class ClassifyResult(BaseModel):
    is_hypothetical: bool
    target_company: str = ""
    target_description: str = ""
    reasoning: str = ""


class DiscoveryResult(BaseModel):
    competitors: list[str] = Field(default_factory=list, max_length=5)
    reasoning: str = ""


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
