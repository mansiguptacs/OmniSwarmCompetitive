import os

import weave

from config import get_settings


def init_weave() -> None:
    settings = get_settings()
    if os.getenv("WEAVE_DISABLED", "").lower() in ("1", "true", "yes"):
        return
    try:
        weave.init(settings.WEAVE_PROJECT)
    except Exception:
        pass
