"""Tests for the CLI entry point."""

from unified_sovereign_estate.__main__ import get_startup_messages, main


def test_get_startup_messages_returns_expected_phrases() -> None:
    messages = get_startup_messages()
    assert "Unified Sovereign Estate dev server is running." in messages
    assert messages[-1].startswith("TODO: replace this stub")


def test_main_logs_startup_banner(caplog) -> None:
    caplog.set_level("INFO")

    main()

    output = " ".join(record.message for record in caplog.records)
    for message in get_startup_messages():
        assert message in output
