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

class Pipeline(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    repo_url: str
    branch: str = "main"

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
