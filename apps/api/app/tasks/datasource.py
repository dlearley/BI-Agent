from __future__ import annotations

"""Celery tasks for datasource operations."""

from typing import Any, Dict

from .celery_app import celery_app
from ..connectors.registry import registry


@celery_app.task(name="datasource.test_connection")
def run_datasource_connection_test(connector_type: str, config: Dict[str, Any]) -> Dict[str, Any]:
    """Execute connector test workflow in the background."""

    connector = registry.create_connector(connector_type, config)
    ok = connector.test_connection()
    schemas = connector.fetch_schemas()
    lineage = connector.fetch_lineage()

    sample_preview: Dict[str, Any] = {}
    for schema in schemas:
        if schema.tables:
            table_name = schema.tables[0]
            sample = connector.fetch_sample_rows(table_name)
            sample_preview[table_name] = sample.rows

    return {
        "ok": ok,
        "schemas": [schema.model_dump() for schema in schemas],
        "lineage": [item.model_dump() for item in lineage],
        "samples": sample_preview,
    }
