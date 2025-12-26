from __future__ import annotations

"""Business logic for managing datasources."""

import json
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from ..connectors.base import BaseConnector
from ..connectors.kms import KMSClient, kms_client
from ..connectors.registry import registry
from ..models import Datasource
from ..schemas import DatasourceCreate, DatasourceRead, DatasourceUpdate


def _serialize_config(connector: BaseConnector[Any]) -> str:
    """Serialize a validated connector config to JSON for encryption."""

    return connector.config.model_dump_json()


def _encrypt_config(serialized_config: str, kms: KMSClient) -> str:
    return kms.encrypt(serialized_config.encode())


def _decrypt_config(ciphertext: str, kms: KMSClient) -> Dict[str, Any]:
    plaintext = kms.decrypt(ciphertext).decode()
    return json.loads(plaintext)


def create_datasource(
    db: Session,
    payload: DatasourceCreate,
    kms: Optional[KMSClient] = None,
) -> Datasource:
    kms_to_use = kms or kms_client
    connector = registry.create_connector(payload.type, payload.config)
    serialized = _serialize_config(connector)
    encrypted = _encrypt_config(serialized, kms_to_use)

    datasource = Datasource(
        name=payload.name,
        type=payload.type,
        description=payload.description,
        config_enc=encrypted,
    )
    db.add(datasource)
    db.commit()
    db.refresh(datasource)
    return datasource


def list_datasources(db: Session) -> list[Datasource]:
    return db.query(Datasource).order_by(Datasource.created_at.asc()).all()


def get_datasource(db: Session, datasource_id: str) -> Optional[Datasource]:
    return db.query(Datasource).filter(Datasource.id == datasource_id).first()


def update_datasource(
    db: Session,
    datasource: Datasource,
    payload: DatasourceUpdate,
    kms: Optional[KMSClient] = None,
) -> Datasource:
    if payload.name is not None:
        datasource.name = payload.name
    if payload.description is not None:
        datasource.description = payload.description

    if payload.config is not None:
        kms_to_use = kms or kms_client
        connector = registry.create_connector(datasource.type, payload.config)
        datasource.config_enc = _encrypt_config(_serialize_config(connector), kms_to_use)

    db.add(datasource)
    db.commit()
    db.refresh(datasource)
    return datasource


def delete_datasource(db: Session, datasource: Datasource) -> None:
    db.delete(datasource)
    db.commit()


def build_connector_from_datasource(
    datasource: Datasource,
    kms: Optional[KMSClient] = None,
) -> BaseConnector[Any]:
    kms_to_use = kms or kms_client
    raw_config = _decrypt_config(datasource.config_enc, kms_to_use)
    return registry.create_connector(datasource.type, raw_config)


def hydrate_datasource(datasource: Datasource) -> DatasourceRead:
    return DatasourceRead.model_validate(datasource)
