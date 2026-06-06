from langchain_core.tools import tool

from config import get_settings
from state import ProductItem
from tools.base import ToolResult

MOCK_PRODUCTS = {
    "stripe": [
        ProductItem(
            name="Payments API",
            description="Online payment processing for internet businesses.",
            pricing="2.9% + 30¢ per transaction",
        ),
        ProductItem(
            name="Billing",
            description="Subscription and invoicing management.",
            pricing="0.5% on recurring charges",
        ),
    ],
    "paypal": [
        ProductItem(
            name="Checkout",
            description="Consumer and merchant checkout solutions.",
            pricing="2.99% + fixed fee",
        ),
    ],
    "adyen": [
        ProductItem(
            name="Unified Commerce",
            description="Enterprise payment platform for global brands.",
            pricing="Custom enterprise pricing",
        ),
    ],
    "square": [
        ProductItem(
            name="Square POS",
            description="Point-of-sale hardware and software.",
            pricing="2.6% + 10¢ per transaction",
        ),
    ],
}


class WebScrapeTool:
    async def scrape_products(self, company: str, max_results: int = 5) -> list[ProductItem]:
        settings = get_settings()
        company_key = company.lower().strip()
        if settings.use_mock_tools:
            return MOCK_PRODUCTS.get(company_key, MOCK_PRODUCTS["stripe"])[:max_results]

        return MOCK_PRODUCTS.get(company_key, [])[:max_results]


_web_scrape_tool = WebScrapeTool()


async def scrape_products(company: str, max_results: int = 5) -> list[ProductItem]:
    return await _web_scrape_tool.scrape_products(company, max_results=max_results)


@tool
async def web_scrape(company: str) -> str:
    """Scrape product and pricing information for a company."""
    items = await scrape_products(company)
    return ToolResult(success=True, data=[item.model_dump() for item in items]).model_dump_json()
