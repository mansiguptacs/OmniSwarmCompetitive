from pydantic import BaseModel


class ToolResult(BaseModel):
    success: bool = True
    data: list | dict | str = []
    error: str = ""
