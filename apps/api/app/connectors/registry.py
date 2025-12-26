from __future__ import annotations

"""Registry for managing available datasource connectors."""

from typing import Any, Dict, Optional, Type

from .base import BaseConnector


class ConnectorRegistry:
    """In-memory registry mapping connector types to classes."""

    def __init__(self) -> None:
        self._registry: Dict[str, Type[BaseConnector[Any]]] = {}

    def register(self, connector_cls: Type[BaseConnector[Any]]) -> None:
        connector_type = getattr(connector_cls, "connector_type", None)
        if not connector_type:
            raise ValueError("Connector classes must define a connector_type attribute")
        self._registry[connector_type] = connector_cls

    def unregister(self, connector_type: str) -> None:
        self._registry.pop(connector_type, None)

    def get(self, connector_type: str) -> Type[BaseConnector[Any]]:
        try:
            return self._registry[connector_type]
        except KeyError as exc:  # pragma: no cover - defensive
            raise KeyError(f"Connector type '{connector_type}' is not registered") from exc

    def create_connector(self, connector_type: str, config: Dict[str, Any]) -> BaseConnector[Any]:
        connector_cls = self.get(connector_type)
        validated_config = connector_cls.validate_config(config)
        return connector_cls(validated_config)

    def list_types(self) -> Dict[str, Type[BaseConnector[Any]]]:
        return dict(self._registry)

    def clear(self) -> None:
        self._registry.clear()


registry = ConnectorRegistry()
