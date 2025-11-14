from __future__ import annotations

import httpx

from apps.api.app.sdk.datasource_client import (
    DatasourceClient,
    DatasourceDetails,
    DatasourceSummary,
    DatasourceTestOutcome,
)


def test_sdk_client_exposes_typed_methods() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/datasources":
            return httpx.Response(200, json=[{"id": "1", "name": "Demo", "type": "fake"}])
        if request.method == "POST" and request.url.path == "/datasources":
            body = request.json()
            body.update({"id": "generated-id"})
            return httpx.Response(201, json=body)
        if request.method == "DELETE" and request.url.path.startswith("/datasources/"):
            return httpx.Response(204)
        if request.method == "POST" and request.url.path == "/datasources/test":
            return httpx.Response(200, json={"ok": True, "message": "ok", "details": {"ok": True}})
        raise AssertionError(f"Unexpected request: {request.method} {request.url}")

    transport = httpx.MockTransport(handler)

    with DatasourceClient(base_url="http://testserver", client=httpx.Client(transport=transport)) as sdk:
        summaries = sdk.list_datasources()
        assert isinstance(summaries, list)
        assert isinstance(summaries[0], DatasourceSummary)

        created = sdk.create_datasource({"name": "Demo", "type": "fake"})
        assert isinstance(created, DatasourceDetails)

        outcome = sdk.test_datasource({"type": "fake", "config": {}})
        assert isinstance(outcome, DatasourceTestOutcome)

        sdk.delete_datasource(created.id)
