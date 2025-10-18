"""Basic smoke tests for repository plumbing."""

from unified_sovereign_estate import __version__


def test_version_is_semantic() -> None:
    parts = __version__.split(".")
    assert len(parts) == 3
    assert all(part.isdigit() for part in parts)
