from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class AssetType(str, Enum):
    CSDN = "CSDN"
    SDN = "SDN"


class AssetStatus(str, Enum):
    INTAKE = "INTAKE"
    VERIFIED = "VERIFIED"
    INSURED = "INSURED"
    ISSUED = "ISSUED"
    CIRCULATING = "CIRCULATING"
    REDEEMED = "REDEEMED"


class TransactionType(str, Enum):
    INTAKE = "INTAKE"
    MINT = "MINT"
    INSURANCE_PREMIUM = "INSURANCE_PREMIUM"
    NAV_UPDATE = "NAV_UPDATE"
    REDEMPTION = "REDEMPTION"
    CIRCULATION = "CIRCULATION"


class FiduciaryRole(str, Enum):
    LAW = "LAW"
    CPA = "CPA"
    TREASURY = "TREASURY"
    INSURANCE = "INSURANCE"
    OPS = "OPS"
    GOVERNANCE = "GOVERNANCE"
    ORACLE = "ORACLE"


class UserStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class LogLevel(str, Enum):
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"


class Asset(Base):
    __tablename__ = "Asset"

    id = Column(Integer, primary_key=True)
    external_id = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    asset_type = Column("assetType", SAEnum(AssetType, name="AssetType"), nullable=False)
    jurisdiction = Column(String, nullable=False)
    valuation_usd = Column("valuationUsd", Numeric(asdecimal=True), nullable=False, default=Decimal("0"))
    status = Column(SAEnum(AssetStatus, name="AssetStatus"), nullable=False, default=AssetStatus.INTAKE)
    intake_at = Column("intakeAt", DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    issuances = relationship("Issuance", back_populates="asset", cascade="all, delete-orphan")
    insurance = relationship("InsuranceBand", back_populates="asset", cascade="all, delete-orphan")
    affidavits = relationship("Affidavit", back_populates="asset", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="asset", cascade="all, delete-orphan")


class Issuance(Base):
    __tablename__ = "Issuance"

    id = Column(Integer, primary_key=True)
    asset_id = Column("assetId", ForeignKey("Asset.id"), nullable=False)
    token_symbol = Column("tokenSymbol", String, nullable=False)
    quantity = Column(Numeric(asdecimal=True), nullable=False, default=Decimal("0"))
    nav_per_token = Column("navPerToken", Numeric(asdecimal=True), nullable=False, default=Decimal("0"))
    policy_floor = Column("policyFloor", Numeric(asdecimal=True), nullable=False, default=Decimal("0"))
    tx_hash = Column("txHash", String, nullable=True)
    issued_at = Column("issuedAt", DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.utcnow, nullable=False)

    asset = relationship("Asset", back_populates="issuances")
    transactions = relationship("Transaction", back_populates="issuance", cascade="all, delete-orphan")


class InsuranceBand(Base):
    __tablename__ = "InsuranceBand"

    id = Column(Integer, primary_key=True)
    asset_id = Column("assetId", ForeignKey("Asset.id"), nullable=False)
    provider = Column(String, nullable=False)
    multiplier = Column(Numeric(asdecimal=True), nullable=False, default=Decimal("0"))
    coverage_usd = Column("coverageUsd", Numeric(asdecimal=True), nullable=False, default=Decimal("0"))
    policy_json = Column("policyJson", Text, nullable=False)
    effective_at = Column("effectiveAt", DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.utcnow, nullable=False)

    asset = relationship("Asset", back_populates="insurance")


class Transaction(Base):
    __tablename__ = "Transaction"

    id = Column(Integer, primary_key=True)
    asset_id = Column("assetId", ForeignKey("Asset.id"), nullable=True)
    issuance_id = Column("issuanceId", ForeignKey("Issuance.id"), nullable=True)
    type = Column(SAEnum(TransactionType, name="TransactionType"), nullable=False)
    amount_usd = Column("amountUsd", Numeric(asdecimal=True), nullable=False, default=Decimal("0"))
    metadata_payload = Column("metadata", JSONB, nullable=True)
    occurred_at = Column("occurredAt", DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.utcnow, nullable=False)

    asset = relationship("Asset", back_populates="transactions")
    issuance = relationship("Issuance", back_populates="transactions")


class Affidavit(Base):
    __tablename__ = "Affidavit"

    id = Column(Integer, primary_key=True)
    asset_id = Column("assetId", ForeignKey("Asset.id"), nullable=False)
    hash = Column(String, unique=True, nullable=False)
    jurisdiction = Column(String, nullable=False)
    clause_ref = Column("clauseRef", String, nullable=False)
    issued_by = Column("issuedBy", String, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.utcnow, nullable=False)

    asset = relationship("Asset", back_populates="affidavits")


class User(Base):
    __tablename__ = "User"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    display_name = Column("displayName", String, nullable=False)
    role = Column(SAEnum(FiduciaryRole, name="FiduciaryRole"), nullable=False)
    status = Column(SAEnum(UserStatus, name="UserStatus"), nullable=False, default=UserStatus.ACTIVE)
    created_at = Column("createdAt", DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    ledger_logs = relationship("LedgerLog", back_populates="user", cascade="all, delete-orphan")


class LedgerLog(Base):
    __tablename__ = "LedgerLog"

    id = Column(Integer, primary_key=True)
    scope = Column(String, nullable=False)
    level = Column(SAEnum(LogLevel, name="LogLevel"), nullable=False, default=LogLevel.INFO)
    message = Column(String, nullable=False)
    metadata_payload = Column("metadata", JSONB, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.utcnow, nullable=False)
    user_id = Column("userId", ForeignKey("User.id"), nullable=True)

    user = relationship("User", back_populates="ledger_logs")
