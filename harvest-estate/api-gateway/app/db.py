from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import scoped_session, sessionmaker

_engine: Engine | None = None
_session_factory: scoped_session | None = None


def init_engine(database_url: str) -> Engine:
    global _engine, _session_factory

    if _engine is None:
        _engine = create_engine(database_url, future=True)
        _session_factory = scoped_session(
            sessionmaker(bind=_engine, autoflush=False, autocommit=False, expire_on_commit=False)
        )

    return _engine


@contextmanager
def session_scope():
    if _session_factory is None:
        raise RuntimeError("Database engine not initialised. Call init_engine first.")

    session = _session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def remove_session() -> None:
    if _session_factory is not None:
        _session_factory.remove()
