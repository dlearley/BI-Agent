from __future__ import annotations

"""Fake connector implementations for testing."""

from typing import Any, Dict, List

from pydantic import BaseModel

from apps.api.app.connectors.base import BaseConnector, LineageMetadata, SampleRows, SchemaMetadata


class FakeConnectorConfig(BaseModel):
    host: str
    username: str
    password: str


class FakeConnector(BaseConnector[FakeConnectorConfig]):
    connector_type = "fake"
    config_model = FakeConnectorConfig
    invocation_counts: Dict[str, int] = {"test_connection": 0, "fetch_schemas": 0, "fetch_sample_rows": 0, "fetch_lineage": 0}

    def test_connection(self) -> bool:
        self.invocation_counts["test_connection"] = self.invocation_counts.get("test_connection", 0) + 1
        return True

    def fetch_schemas(self) -> List[SchemaMetadata]:
        self.invocation_counts["fetch_schemas"] = self.invocation_counts.get("fetch_schemas", 0) + 1
        return [SchemaMetadata(name="public", tables=["users", "orders"])]

    def fetch_sample_rows(self, table: str, limit: int = 5) -> SampleRows:
        self.invocation_counts["fetch_sample_rows"] = self.invocation_counts.get("fetch_sample_rows", 0) + 1
        rows = [{"id": 1, "table": table}, {"id": 2, "table": table}][:limit]
        return SampleRows(table=table, rows=rows)

    def fetch_lineage(self) -> List[LineageMetadata]:
        self.invocation_counts["fetch_lineage"] = self.invocation_counts.get("fetch_lineage", 0) + 1
        return [LineageMetadata(source="users", targets=["orders"], metadata={"confidence": 0.9})]

    @classmethod
    def reset_counts(cls) -> None:
        cls.invocation_counts = {key: 0 for key in cls.invocation_counts}
