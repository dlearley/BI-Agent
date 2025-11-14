from __future__ import annotations

"""Typed SDK client for interacting with the Connector API service."""

from typing import Any, Dict, Iterable, List, Optional

import httpx
from pydantic import BaseModel


class DatasourceSummary(BaseModel):
    id: str
    name: str
    type: str


class DatasourceDetails(BaseModel):
    id: str
    name: str
    type: str
    description: Optional[str] = None


class DatasourceTestOutcome(BaseModel):
    ok: bool
    message: str
    details: Dict[str, Any]


class DatasourceClient:
    """Small typed HTTP client for consuming datasource endpoints."""

    def __init__(
        self,
        base_url: str,
        *,
        client: Optional[httpx.Client] = None,
        timeout: Optional[float] = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._client = client or httpx.Client(base_url=self._base_url, timeout=timeout)

    def list_datasources(self) -> List[DatasourceSummary]:
        response = self._client.get("/datasources")
        response.raise_for_status()
        return [DatasourceSummary.model_validate(item) for item in response.json()]

    def create_datasource(self, payload: Dict[str, Any]) -> DatasourceDetails:
        response = self._client.post("/datasources", json=payload)
        response.raise_for_status()
        return DatasourceDetails.model_validate(response.json())

    def delete_datasource(self, datasource_id: str) -> None:
        response = self._client.delete(f"/datasources/{datasource_id}")
        response.raise_for_status()

    def test_datasource(self, payload: Dict[str, Any]) -> DatasourceTestOutcome:
        response = self._client.post("/datasources/test", json=payload)
        response.raise_for_status()
        return DatasourceTestOutcome.model_validate(response.json())

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "DatasourceClient":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()
