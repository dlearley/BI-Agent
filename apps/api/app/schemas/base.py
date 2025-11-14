from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any, List
from datetime import datetime


# Organization schemas
class OrganizationBase(BaseModel):
    name: str
    slug: str
    domain: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    domain: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class Organization(OrganizationBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# User schemas
class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    password: Optional[str] = None


class User(UserBase):
    id: int
    status: str
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    organization_id: int

    class Config:
        from_attributes = True


# Team schemas
class TeamBase(BaseModel):
    name: str
    description: Optional[str] = None


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class Team(TeamBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    organization_id: int

    class Config:
        from_attributes = True


# Membership schemas
class MembershipBase(BaseModel):
    role: str


class MembershipCreate(MembershipBase):
    user_id: int
    organization_id: int
    team_id: Optional[int] = None


class Membership(MembershipBase):
    id: int
    user_id: int
    organization_id: int
    team_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# DataSource schemas
class DataSourceBase(BaseModel):
    name: str
    type: str
    connection_config: Dict[str, Any]
    is_active: bool = True


class DataSourceCreate(DataSourceBase):
    pass


class DataSourceUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    connection_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class DataSource(DataSourceBase):
    id: int
    organization_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Dataset schemas
class DatasetBase(BaseModel):
    name: str
    description: Optional[str] = None
    table_name: str
    schema_config: Optional[Dict[str, Any]] = None
    is_active: bool = True


class DatasetCreate(DatasetBase):
    data_source_id: int


class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    table_name: Optional[str] = None
    schema_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class Dataset(DatasetBase):
    id: int
    organization_id: int
    data_source_id: int
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True