from datetime import datetime
from enum import Enum
from sqlmodel import SQLModel, Field

class Role(str, Enum):
    admin = "admin"
    dev = "dev"
    viewer = "viewer"

class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    username: str = Field(index=True)
    role: Role = Field(default=Role.viewer)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Pipeline(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    repo_url: str
    branch: str = "main"
    github_url: str = Field(default="")  # alias pour repo_url
    status: str = Field(default="pending")
    created_by: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class RunStatus(str, Enum):
    pending = "PENDING"
    running = "RUNNING"
    success = "SUCCESS"
    failed = "FAILED"

class Run(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    pipeline_id: int
    status: RunStatus = Field(default=RunStatus.pending)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: int  # user id
