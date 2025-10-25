from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict

from .models import Affidavit, Asset, InsuranceBand, Issuance, LedgerLog, Transaction


def _decimal(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return format(value, "f")


def serialize_asset(asset: Asset) -> Dict[str, Any]:
    return {
        "id": asset.id,
        "externalId": asset.external_id,
        "name": asset.name,
        "assetType": asset.asset_type.value,
        "jurisdiction": asset.jurisdiction,
        "valuationUsd": _decimal(asset.valuation_usd),
        "status": asset.status.value,
        "intakeAt": asset.intake_at.isoformat() if asset.intake_at else None,
        "updatedAt": asset.updated_at.isoformat() if asset.updated_at else None,
        "issuances": [serialize_issuance(i) for i in asset.issuances],
        "insurance": [serialize_insurance(band) for band in asset.insurance],
        "affidavits": [serialize_affidavit(a) for a in asset.affidavits],
    }


def serialize_issuance(issuance: Issuance) -> Dict[str, Any]:
    return {
        "id": issuance.id,
        "assetId": issuance.asset_id,
        "tokenSymbol": issuance.token_symbol,
        "quantity": _decimal(issuance.quantity),
        "navPerToken": _decimal(issuance.nav_per_token),
        "policyFloor": _decimal(issuance.policy_floor),
        "txHash": issuance.tx_hash,
        "issuedAt": issuance.issued_at.isoformat() if issuance.issued_at else None,
    }


def serialize_insurance(band: InsuranceBand) -> Dict[str, Any]:
    return {
        "id": band.id,
        "assetId": band.asset_id,
        "provider": band.provider,
        "multiplier": _decimal(band.multiplier),
        "coverageUsd": _decimal(band.coverage_usd),
        "policy": band.policy_json,
        "effectiveAt": band.effective_at.isoformat() if band.effective_at else None,
    }


def serialize_affidavit(affidavit: Affidavit) -> Dict[str, Any]:
    return {
        "id": affidavit.id,
        "assetId": affidavit.asset_id,
        "hash": affidavit.hash,
        "jurisdiction": affidavit.jurisdiction,
        "clauseRef": affidavit.clause_ref,
        "issuedBy": affidavit.issued_by,
        "createdAt": affidavit.created_at.isoformat() if affidavit.created_at else None,
    }


def serialize_transaction(tx: Transaction) -> Dict[str, Any]:
    return {
        "id": tx.id,
        "assetId": tx.asset_id,
        "issuanceId": tx.issuance_id,
        "type": tx.type.value,
        "amountUsd": _decimal(tx.amount_usd),
        "metadata": tx.metadata_payload,
        "occurredAt": tx.occurred_at.isoformat() if tx.occurred_at else None,
    }


def serialize_ledger_log(log: LedgerLog) -> Dict[str, Any]:
    return {
        "id": log.id,
        "scope": log.scope,
        "level": log.level.value,
        "message": log.message,
        "metadata": log.metadata_payload,
        "createdAt": log.created_at.isoformat() if log.created_at else None,
        "user": {
            "id": log.user.id,
            "displayName": log.user.display_name,
            "role": log.user.role.value,
        }
        if log.user
        else None,
    }
