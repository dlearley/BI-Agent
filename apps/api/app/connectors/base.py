from __future__ import annotations

"""Abstract connector definitions for pluggable datasources."""

from abc import ABC, abstractmethod
from typing import Any, Dict, Generic, List, Type, TypeVar

from pydantic import BaseModel, Field


class SchemaMetadata(BaseModel):
    """Metadata describing schemas available in a datasource."""

    name: str
    tables: List[str] = Field(default_factory=list)
    extra: Dict[str, Any] = Field(default_factory=dict)


class SampleRows(BaseModel):
    """Sample rows preview for a given table."""

    table: str
    rows: List[Dict[str, Any]] = Field(default_factory=list)


class LineageMetadata(BaseModel):
    """Lineage relationships discovered for a datasource."""

    source: str
    targets: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


ConfigModelT = TypeVar("ConfigModelT", bound=BaseModel)


class BaseConnector(Generic[ConfigModelT], ABC):
    """Base class all datasource connectors must implement."""

    connector_type: str
    config_model: Type[ConfigModelT]

    def __init__(self, config: ConfigModelT) -> None:
        self.config = config

    @classmethod
    def validate_config(cls, config: Dict[str, Any]) -> ConfigModelT:
        """Validate raw config payload into the connector schema."""

        return cls.config_model.model_validate(config)

    @abstractmethod
    def test_connection(self) -> bool:
        """Validate connectivity to the datasource."""

    @abstractmethod
    def fetch_schemas(self) -> List[SchemaMetadata]:
        """Return schemas/tables the connector can access."""

    @abstractmethod
    def fetch_sample_rows(self, table: str, limit: int = 5) -> SampleRows:
        """Return sample rows for previewing data."""

    @abstractmethod
    def fetch_lineage(self) -> List[LineageMetadata]:
        """Return lineage metadata for the datasource."""
