from __future__ import annotations

from apps.api.app.connectors.registry import registry
from apps.api.app.tasks.datasource import run_datasource_connection_test
from .fakes import FakeConnector


def test_connector_registry_executes_task_workflow() -> None:
    FakeConnector.reset_counts()
    registry.register(FakeConnector)

    result = run_datasource_connection_test.apply(args=(
        FakeConnector.connector_type,
        {"host": "localhost", "username": "demo", "password": "secret"},
    )).get()

    assert result["ok"] is True
    assert FakeConnector.invocation_counts["test_connection"] == 1
    assert FakeConnector.invocation_counts["fetch_schemas"] == 1
    assert FakeConnector.invocation_counts["fetch_lineage"] == 1
    assert FakeConnector.invocation_counts["fetch_sample_rows"] >= 1
    assert "schemas" in result and result["schemas"][0]["name"] == "public"
