// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessRoles} from "./AccessRoles.sol";

/**
 * @title AnimaOS
 * @notice Governance guard that evaluates workflow requests and enforces override flags.
 */
contract AnimaOS is AccessRoles {
    struct RiskStatus {
        bool overMint;
        bool misCollateralisation;
        bool jurisdictionConflict;
    }

    enum Policy {
        UNSET,
        ALLOW,
        BLOCK
    }

    mapping(bytes32 => mapping(bytes32 => Policy)) private _actionPolicy;
    mapping(bytes32 => RiskStatus) private _assetRisk;

    event ActionOverrideSet(bytes32 indexed assetId, bytes32 indexed action, bool allowed, address indexed actor);
    event RiskUpdated(bytes32 indexed assetId, RiskStatus status, address indexed actor);

    constructor(address admin) AccessRoles(admin) {}

    function setActionOverride(
        bytes32 assetId,
        bytes32 action,
        bool allowed
    ) external onlyRole(GOVERNANCE_ROLE) {
        _actionPolicy[assetId][action] = allowed ? Policy.ALLOW : Policy.BLOCK;
        emit ActionOverrideSet(assetId, action, allowed, msg.sender);
    }

    function setRiskStatus(
        bytes32 assetId,
        bool overMint,
        bool misCollateral,
        bool jurisdictionConflict
    ) external onlyRole(GOVERNANCE_ROLE) {
        _assetRisk[assetId] = RiskStatus(overMint, misCollateral, jurisdictionConflict);
        emit RiskUpdated(assetId, _assetRisk[assetId], msg.sender);
    }

    function ok(bytes32 assetId, bytes32 action) external view returns (bool) {
        RiskStatus memory status = _assetRisk[assetId];
        if (status.overMint || status.misCollateralisation || status.jurisdictionConflict) {
            return false;
        }

        Policy policy = _actionPolicy[assetId][action];
        if (policy == Policy.BLOCK) {
            return false;
        }
        if (policy == Policy.ALLOW) {
            return true;
        }
        return true;
    }

    function riskStatus(bytes32 assetId) external view returns (RiskStatus memory) {
        return _assetRisk[assetId];
    }
}
