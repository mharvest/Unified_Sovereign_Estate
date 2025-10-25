from __future__ import annotations

import json
from decimal import Decimal
from typing import Any, Dict, Optional

import requests
from flask import Blueprint, current_app, jsonify, request
from web3 import Web3

from .db import session_scope
from .models import (
    Affidavit,
    Asset,
    AssetStatus,
    AssetType,
    FiduciaryRole,
    InsuranceBand,
    Issuance,
    LedgerLog,
    LogLevel,
    Transaction,
    TransactionType,
    User,
)
from .serialization import serialize_affidavit, serialize_asset, serialize_transaction

bp = Blueprint("sovereign", __name__)


def _decimal_from_payload(value: Any) -> Decimal:
    if value is None:
        raise ValueError("Decimal value missing")
    return Decimal(str(value))


def _user_for_role(session, role: FiduciaryRole) -> Optional[User]:
    return session.query(User).filter(User.role == role).first()


@bp.get("/health")
def health():
    config = current_app.config["ESTATE_CONFIG"]
    return jsonify({"ok": True, "service": "api-gateway", "mode": config.estate_mode})


@bp.post("/intake")
def intake():
    payload = request.get_json(force=True) or {}

    external_id = payload.get("externalId")
    name = payload.get("name")
    asset_type = payload.get("assetType", "CSDN").upper()
    jurisdiction = payload.get("jurisdiction", "US-DE-TRUST")
    valuation = payload.get("valuationUsd", 0)

    if not external_id or not name:
        return jsonify({"ok": False, "error": "missing_required_fields"}), 400

    with session_scope() as session:
        asset = session.query(Asset).filter(Asset.external_id == external_id).one_or_none()

    try:
        asset_type_enum = AssetType(asset_type)
    except ValueError:
        return jsonify({"ok": False, "error": "invalid_asset_type"}), 400

    with session_scope() as session:
        asset = session.query(Asset).filter(Asset.external_id == external_id).one_or_none()

        if asset is None:
            asset = Asset(
                external_id=external_id,
                name=name,
                asset_type=asset_type_enum,
                jurisdiction=jurisdiction,
                valuation_usd=_decimal_from_payload(valuation),
                status=AssetStatus.VERIFIED,
            )
            session.add(asset)
            session.flush()
        else:
            asset.name = name
            asset.asset_type = asset_type_enum
            asset.jurisdiction = jurisdiction
            asset.valuation_usd = _decimal_from_payload(valuation)
            asset.status = AssetStatus.VERIFIED

        law_user = _user_for_role(session, FiduciaryRole.LAW)
        session.add(
            LedgerLog(
                scope=f"workflow:{asset.external_id.lower()}",
                level=LogLevel.INFO,
                message=f"Intake verified for {asset.name}",
                metadata_payload={"valuationUsd": str(asset.valuation_usd)},
                user=law_user,
            )
        )

        session.flush()
        return jsonify({"ok": True, "asset": serialize_asset(asset)})


@bp.post("/insurance")
def apply_insurance():
    payload = request.get_json(force=True) or {}
    external_id = payload.get("externalId")
    multiplier = payload.get("multiplier")
    coverage_usd = payload.get("coverageUsd")
    jurisdiction = payload.get("jurisdiction", "US-DE")
    provider = payload.get("provider", "Matriarch")
    floor = payload.get("floor", 0.85)
    terms = payload.get("terms", {})

    if not external_id or multiplier is None or coverage_usd is None:
        return jsonify({"ok": False, "error": "missing_required_fields"}), 400

    with session_scope() as session:
        asset = session.query(Asset).filter(Asset.external_id == external_id).one_or_none()
        if asset is None:
            return jsonify({"ok": False, "error": "asset_not_found"}), 404

        band = (
            session.query(InsuranceBand)
            .filter(InsuranceBand.asset_id == asset.id, InsuranceBand.provider == provider)
            .one_or_none()
        )

        policy_payload = {
            "jurisdiction": jurisdiction,
            "multiplier": multiplier,
            "coverageUsd": coverage_usd,
            "floor": floor,
            **terms,
        }

        if band is None:
            band = InsuranceBand(
                asset_id=asset.id,
                provider=provider,
                multiplier=_decimal_from_payload(multiplier),
                coverage_usd=_decimal_from_payload(coverage_usd),
                policy_json=json.dumps(policy_payload),
            )
            session.add(band)
        else:
            band.multiplier = _decimal_from_payload(multiplier)
            band.coverage_usd = _decimal_from_payload(coverage_usd)
            band.policy_json = json.dumps(policy_payload)

        asset.status = AssetStatus.INSURED

        insurance_user = _user_for_role(session, FiduciaryRole.INSURANCE)
        session.add(
            LedgerLog(
                scope=f"workflow:{asset.external_id.lower()}",
                level=LogLevel.INFO,
                message=f"Insurance applied to {asset.name} at {multiplier}x",
                metadata_payload={"coverageUsd": str(coverage_usd), "jurisdiction": jurisdiction},
                user=insurance_user,
            )
        )

        session.flush()
        return jsonify({"ok": True, "asset": serialize_asset(asset)})


@bp.post("/mint")
def mint():
    payload = request.get_json(force=True) or {}
    external_id = payload.get("externalId")
    quantity = payload.get("quantity")
    nav_per_token = payload.get("navPerToken")
    policy_floor = payload.get("policyFloor", nav_per_token)
    token_symbol = payload.get("tokenSymbol", "HRVST")

    if not external_id or quantity is None or nav_per_token is None:
        return jsonify({"ok": False, "error": "missing_required_fields"}), 400

    with session_scope() as session:
        asset = session.query(Asset).filter(Asset.external_id == external_id).one_or_none()
        if asset is None:
            return jsonify({"ok": False, "error": "asset_not_found"}), 404

        issuance = (
            session.query(Issuance)
            .filter(Issuance.asset_id == asset.id, Issuance.token_symbol == token_symbol)
            .one_or_none()
        )

        tx_hash = Web3.keccak(
            text=f"{external_id}:{quantity}:{nav_per_token}:{policy_floor}:{token_symbol}"
        ).hex()

        if issuance is None:
            issuance = Issuance(
                asset_id=asset.id,
                token_symbol=token_symbol,
                quantity=_decimal_from_payload(quantity),
                nav_per_token=_decimal_from_payload(nav_per_token),
                policy_floor=_decimal_from_payload(policy_floor),
                tx_hash=tx_hash,
            )
            session.add(issuance)
            session.flush()
        else:
            issuance.quantity = _decimal_from_payload(quantity)
            issuance.nav_per_token = _decimal_from_payload(nav_per_token)
            issuance.policy_floor = _decimal_from_payload(policy_floor)
            issuance.tx_hash = tx_hash

        asset.status = AssetStatus.ISSUED

        tx_entry = Transaction(
            asset_id=asset.id,
            issuance_id=issuance.id,
            type=TransactionType.MINT,
            amount_usd=_decimal_from_payload(quantity),
            metadata_payload={
                "navPerToken": str(nav_per_token),
                "policyFloor": str(policy_floor),
                "txHash": tx_hash,
            },
        )
        session.add(tx_entry)

        treasury_user = _user_for_role(session, FiduciaryRole.TREASURY)
        session.add(
            LedgerLog(
                scope=f"workflow:{asset.external_id.lower()}",
                level=LogLevel.INFO,
                message=f"{quantity} {token_symbol} tokens minted for {asset.name}",
                metadata_payload={"navPerToken": str(nav_per_token), "txHash": tx_hash},
                user=treasury_user,
            )
        )

        session.flush()
        return jsonify(
            {
                "ok": True,
                "asset": serialize_asset(asset),
                "transaction": serialize_transaction(tx_entry),
            }
        )


@bp.post("/circulate")
def circulate():
    payload = request.get_json(force=True) or {}
    external_id = payload.get("externalId")
    amount_usd = payload.get("amountUsd")
    tenor_days = payload.get("tenorDays", 90)
    desk = payload.get("desk", "Kiiantu")

    if not external_id or amount_usd is None:
        return jsonify({"ok": False, "error": "missing_required_fields"}), 400

    with session_scope() as session:
        asset = session.query(Asset).filter(Asset.external_id == external_id).one_or_none()
        if asset is None:
            return jsonify({"ok": False, "error": "asset_not_found"}), 404

        issuance = (
            session.query(Issuance)
            .filter(Issuance.asset_id == asset.id)
            .order_by(Issuance.created_at.desc())
            .first()
        )

        tx_entry = Transaction(
            asset_id=asset.id,
            issuance_id=issuance.id if issuance else None,
            type=TransactionType.CIRCULATION,
            amount_usd=_decimal_from_payload(amount_usd),
            metadata_payload={"desk": desk, "tenorDays": tenor_days},
        )
        session.add(tx_entry)

        asset.status = AssetStatus.CIRCULATING

        ops_user = _user_for_role(session, FiduciaryRole.OPS)
        session.add(
            LedgerLog(
                scope=f"workflow:{asset.external_id.lower()}",
                level=LogLevel.INFO,
                message=f"Liquidity circulated via {desk} for {asset.name}",
                metadata_payload={"amountUsd": str(amount_usd), "tenorDays": tenor_days},
                user=ops_user,
            )
        )

        session.flush()
        return jsonify({"ok": True, "asset": serialize_asset(asset), "transaction": serialize_transaction(tx_entry)})


@bp.post("/redeem")
def redeem():
    payload = request.get_json(force=True) or {}
    external_id = payload.get("externalId")
    holder_id = payload.get("holderId")
    tokens = payload.get("tokens")

    if not all([external_id, holder_id, tokens]):
        return jsonify({"ok": False, "error": "missing_required_fields"}), 400

    config = current_app.config["ESTATE_CONFIG"]
    try:
        response = requests.post(
            f"{config.se7en_url}/treasury/redeem",
            json={"holderId": holder_id, "tokens": tokens},
            timeout=10,
        )
        redemption = response.json()
    except requests.RequestException as exc:
        return jsonify({"ok": False, "error": "se7en_unreachable", "detail": str(exc)}), 502

    status_code = response.status_code

    with session_scope() as session:
        asset = session.query(Asset).filter(Asset.external_id == external_id).one_or_none()
        if asset:
            issuance = (
                session.query(Issuance)
                .filter(Issuance.asset_id == asset.id)
                .order_by(Issuance.created_at.desc())
                .first()
            )

            tx_entry = Transaction(
                asset_id=asset.id,
                issuance_id=issuance.id if issuance else None,
                type=TransactionType.REDEMPTION,
                amount_usd=_decimal_from_payload(tokens),
                metadata_payload={"holderId": holder_id, "status": redemption.get("ok")},
            )
            session.add(tx_entry)

            if redemption.get("ok"):
                asset.status = AssetStatus.REDEEMED

            oracle_user = _user_for_role(session, FiduciaryRole.ORACLE)
            session.add(
                LedgerLog(
                    scope=f"workflow:{asset.external_id.lower()}",
                    level=LogLevel.INFO,
                    message=f"Redemption processed for {asset.name}",
                    metadata_payload={"holderId": holder_id, "tokens": tokens},
                    user=oracle_user,
                )
            )

    redemption["source"] = "se7en"
    return jsonify(redemption), status_code


@bp.get("/verify/<attestation_id>")
def verify(attestation_id: str):
    with session_scope() as session:
        affidavit = session.query(Affidavit).filter(Affidavit.hash == attestation_id).one_or_none()
        if affidavit is None:
            return jsonify({"ok": False, "error": "affidavit_not_found"}), 404
        asset = affidavit.asset
        return jsonify(
            {
                "ok": True,
                "attestation": serialize_affidavit(affidavit),
                "asset": serialize_asset(asset),
            }
        )
