from __future__ import annotations

from typing import Any, Dict

from apps.api.app.connectors.kms import kms_client
from apps.api.app.connectors.registry import registry
from apps.api.app.database import SessionLocal
from apps.api.app.models import Datasource
from .fakes import FakeConnector


def _create_payload(overrides: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "name": "Demo Datasource",
        "type": FakeConnector.connector_type,
        "description": "Demo",
        "config": {"host": "localhost", "username": "demo", "password": "secret"},
    }
    if overrides:
        payload.update(overrides)
    return payload


def test_create_datasource_encrypts_config(client) -> None:
    FakeConnector.reset_counts()
    registry.register(FakeConnector)

    response = client.post("/datasources", json=_create_payload())
    assert response.status_code == 201, response.text
    data = response.json()

    with SessionLocal() as session:
        datasource = session.get(Datasource, data["id"])
        assert datasource is not None
        assert datasource.config_enc != ""
        assert "secret" not in datasource.config_enc
        decrypted = kms_client.decrypt(datasource.config_enc).decode()
        assert "secret" in decrypted


def test_datasource_test_endpoint_invokes_connector(client) -> None:
    FakeConnector.reset_counts()
    registry.register(FakeConnector)

    create_resp = client.post("/datasources", json=_create_payload())
    datasource_id = create_resp.json()["id"]

    test_resp = client.post("/datasources/test", json={"datasource_id": datasource_id})
    assert test_resp.status_code == 200
    body = test_resp.json()
    assert body["ok"] is True
    assert FakeConnector.invocation_counts["test_connection"] >= 1
