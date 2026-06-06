"""P4-owned observability settings (env vars). Does not modify backend/config.py."""

from __future__ import annotations

import os
from functools import lru_cache


@lru_cache
def get_observability_settings() -> "ObservabilitySettings":
    return ObservabilitySettings()


class ObservabilitySettings:
    """Read from ccie/.env via env_loader before first access in CLIs."""

    @property
    def stale_news_threshold_days(self) -> int:
        return int(os.getenv("CCIE_STALE_NEWS_DAYS", "90"))

    @property
    def freshness_window_days(self) -> int:
        return int(os.getenv("CCIE_FRESHNESS_WINDOW_DAYS", "90"))

    @property
    def implausible_usd_threshold(self) -> float:
        return float(os.getenv("CCIE_IMPLAUSIBLE_USD_THRESHOLD", "5000000000000"))

    @property
    def auto_score_enabled(self) -> bool:
        return os.getenv("CCIE_AUTO_SCORE", "").lower() in ("1", "true", "yes")

    @property
    def auto_apply_weave_scorers(self) -> bool:
        return os.getenv("CCIE_AUTO_APPLY_WEAVE_SCORERS", "").lower() in ("1", "true", "yes")

    def as_dict(self) -> dict:
        return {
            "stale_news_threshold_days": self.stale_news_threshold_days,
            "freshness_window_days": self.freshness_window_days,
            "implausible_usd_threshold": self.implausible_usd_threshold,
            "auto_score_enabled": self.auto_score_enabled,
            "auto_apply_weave_scorers": self.auto_apply_weave_scorers,
        }
