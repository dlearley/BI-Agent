from __future__ import annotations

"""Pydantic schemas for datasource operations."""

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, model_validator


class DatasourceBase(BaseModel):
    name: str = Field(..., max_length=255)
    type: str = Field(..., max_length=64)
    description: Optional[str] = Field(default=None)


class DatasourceCreate(DatasourceBase):
    config: Dict[str, Any]


class DatasourceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class DatasourceRead(DatasourceBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DatasourceTestRequest(BaseModel):
    datasource_id: Optional[str] = None
    type: Optional[str] = Field(default=None, max_length=64)
    config: Optional[Dict[str, Any]] = None

    @model_validator(mode="after")
    def validate_payload(self) -> "DatasourceTestRequest":
        if self.datasource_id:
            return self
        if not self.type or not self.config:
            raise ValueError("Either datasource_id or both type and config must be provided")
        return self


class DatasourceTestResult(BaseModel):
    ok: bool
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)
