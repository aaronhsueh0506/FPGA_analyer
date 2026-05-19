from datetime import datetime
from typing import List, Optional

from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from pydantic import BaseModel, ConfigDict

from .db import Base


# ─── SQLAlchemy ORM ────────────────────────────────────────────────────────

class RegisterDefinitionORM(Base):
    __tablename__ = "register_definitions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False)
    original_filename = Column(Text)
    file_path = Column(Text, nullable=False)
    register_count = Column(Integer)
    bitfield_count = Column(Integer)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    batches = relationship("BatchORM", back_populates="register", cascade="all, delete-orphan")


class BatchORM(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text)
    register_definition_id = Column(Integer, ForeignKey("register_definitions.id"), nullable=False)
    dat_count = Column(Integer)
    warning_count = Column(Integer, default=0)
    result_csv_path = Column(Text)
    result_xlsx_path = Column(Text)
    analyzed_at = Column(DateTime, default=datetime.utcnow)

    register = relationship("RegisterDefinitionORM", back_populates="batches")


# ─── Pydantic Schemas ──────────────────────────────────────────────────────

class RegisterDefinitionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    original_filename: Optional[str]
    register_count: Optional[int]
    bitfield_count: Optional[int]
    uploaded_at: datetime


class BatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: Optional[str]
    register_name: str
    dat_count: Optional[int]
    warning_count: int
    analyzed_at: datetime


class BitFieldDefSchema(BaseModel):
    name: str
    width: int
    register_name: str
    register_addr: str


class BatchRowSchema(BaseModel):
    testCase: str
    values: List[Optional[int]]


class BatchDetailOut(BaseModel):
    summary: BatchOut
    bitFields: List[BitFieldDefSchema]
    rows: List[BatchRowSchema]
    warnings: List[str]


class RegisterRenameIn(BaseModel):
    name: str


class VersionOut(BaseModel):
    version: str
    build_date: str
    author: str
