"""Developer entry point for local experimentation."""

from __future__ import annotations

import logging
from typing import Iterable

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")


def get_startup_messages() -> tuple[str, ...]:
    """Return the banner messages shown when the dev server boots."""
    return (
        "Unified Sovereign Estate dev server is running.",
        "TODO: replace this stub with the actual application server.",
    )


def emit_messages(messages: Iterable[str]) -> None:
    """Log each message at info level, preserving their order."""
    for message in messages:
        logger.info(message)


def main() -> None:
    """Boot the placeholder development server."""
    emit_messages(get_startup_messages())


if __name__ == "__main__":  # pragma: no cover - exercised by manual CLI runs
    main()
