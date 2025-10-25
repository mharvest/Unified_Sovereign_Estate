from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(slots=True)
class Config:
    database_url: str
    estate_mode: str
    se7en_url: str
    eklesia_url: str


def load_config() -> Config:
    database_url = os.getenv("DATABASE_URL", "postgresql+psycopg://se7en:sovereign@postgres:5432/estate")
    estate_mode = os.getenv("ESTATE_MODE", "DEMO").upper()
    se7en_url = os.getenv("SE7EN_API_URL", "http://se7en:4000")
    eklesia_url = os.getenv("EKLESIA_API_URL", "http://eklesia:8545")

    return Config(
        database_url=database_url,
        estate_mode=estate_mode,
        se7en_url=se7en_url,
        eklesia_url=eklesia_url,
    )
