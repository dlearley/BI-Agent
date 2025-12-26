from __future__ import annotations

"""Datasources API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..dependencies import get_db, get_kms
from ..schemas import (
    DatasourceCreate,
    DatasourceRead,
    DatasourceTestRequest,
    DatasourceTestResult,
    DatasourceUpdate,
)
from ..services import datasource_service
from ..tasks.datasource import run_datasource_connection_test

router = APIRouter(prefix="/datasources", tags=["datasources"])


@router.get("", response_model=list[DatasourceRead])
def list_datasources(db: Session = Depends(get_db)) -> list[DatasourceRead]:
    datasources = datasource_service.list_datasources(db)
    return [datasource_service.hydrate_datasource(ds) for ds in datasources]


@router.post("", response_model=DatasourceRead, status_code=status.HTTP_201_CREATED)
def create_datasource(
    payload: DatasourceCreate,
    db: Session = Depends(get_db),
) -> DatasourceRead:
    datasource = datasource_service.create_datasource(db, payload)
    return datasource_service.hydrate_datasource(datasource)


@router.get("/{datasource_id}", response_model=DatasourceRead)
def get_datasource(datasource_id: str, db: Session = Depends(get_db)) -> DatasourceRead:
    datasource = datasource_service.get_datasource(db, datasource_id)
    if not datasource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Datasource not found")
    return datasource_service.hydrate_datasource(datasource)


@router.put("/{datasource_id}", response_model=DatasourceRead)
def update_datasource(
    datasource_id: str,
    payload: DatasourceUpdate,
    db: Session = Depends(get_db),
) -> DatasourceRead:
    datasource = datasource_service.get_datasource(db, datasource_id)
    if not datasource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Datasource not found")
    updated = datasource_service.update_datasource(db, datasource, payload)
    return datasource_service.hydrate_datasource(updated)


@router.delete("/{datasource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_datasource(datasource_id: str, db: Session = Depends(get_db)) -> None:
    datasource = datasource_service.get_datasource(db, datasource_id)
    if not datasource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Datasource not found")
    datasource_service.delete_datasource(db, datasource)


@router.post("/test", response_model=DatasourceTestResult)
def test_datasource_connection(
    payload: DatasourceTestRequest,
    db: Session = Depends(get_db),
) -> DatasourceTestResult:
    if payload.datasource_id:
        datasource = datasource_service.get_datasource(db, payload.datasource_id)
        if not datasource:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Datasource not found")
        kms = get_kms()
        connector = datasource_service.build_connector_from_datasource(datasource, kms)
        connector_type = datasource.type
        config_payload = connector.config.model_dump()
    else:
        if payload.type is None or payload.config is None:  # pragma: no cover - validation guard
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Connector type and config required")
        connector_type = payload.type
        config_payload = payload.config

    # Execute connection test via Celery task (runs eagerly in test/dev configuration)
    task_result = run_datasource_connection_test.delay(connector_type, config_payload)
    details = task_result.get()
    message = "Connection successful" if details.get("ok") else "Connection failed"
    return DatasourceTestResult(ok=details.get("ok", False), message=message, details=details)
