import logging
import os

from config import get_settings
from observability.env_loader import load_ccie_env

logger = logging.getLogger(__name__)


def _weave_disabled() -> bool:
    return os.getenv("WEAVE_DISABLED", "").lower() in ("1", "true", "yes")


def init_weave() -> bool:
    """Initialize W&B Weave. Returns True when tracing is active."""
    load_ccie_env()

    if _weave_disabled():
        logger.info("Weave disabled (WEAVE_DISABLED=1)")
        return False

    if not os.getenv("WANDB_API_KEY"):
        logger.warning(
            "WANDB_API_KEY not set — Weave tracing skipped. "
            "Set WANDB_API_KEY to enable observability dashboard."
        )
        return False

    try:
        import weave

        settings = get_settings()
        weave.init(settings.WEAVE_PROJECT)
        logger.info("Weave initialized for project %s", settings.WEAVE_PROJECT)
        return True
    except Exception as exc:
        logger.warning("Weave init failed: %s", exc)
        return False
