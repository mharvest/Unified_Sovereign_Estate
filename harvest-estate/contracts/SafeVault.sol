// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessRoles} from "./AccessRoles.sol";

/**
 * @title SafeVault
 * @notice Custody and document ledger for asset artifacts (appraisals, deeds, payoff letters).
 */
contract SafeVault is AccessRoles {
    struct CustodyRecord {
        bool custody;
        uint256 updatedAt;
    }

    mapping(bytes32 => CustodyRecord) private _custody;
    mapping(bytes32 => bytes32[]) private _docsByAsset;
    mapping(bytes32 => mapping(bytes32 => bool)) private _docExists;

    event CustodyUpdated(bytes32 indexed assetId, bool custody, uint256 timestamp, address indexed actor);
    event DocumentStored(bytes32 indexed assetId, bytes32 indexed docHash, address indexed actor);

    constructor(address admin) AccessRoles(admin) {}

    function setCustody(bytes32 assetId, bool value) external onlyRole(TRUSTEE_ROLE) {
        CustodyRecord storage record = _custody[assetId];
        record.custody = value;
        record.updatedAt = block.timestamp;
        emit CustodyUpdated(assetId, value, block.timestamp, msg.sender);
    }

    function setDoc(bytes32 assetId, bytes32 docHash) external onlyRole(TRUSTEE_ROLE) {
        require(docHash != bytes32(0), "INVALID_HASH");
        if (!_docExists[assetId][docHash]) {
            _docExists[assetId][docHash] = true;
            _docsByAsset[assetId].push(docHash);
            emit DocumentStored(assetId, docHash, msg.sender);
        }
    }

    function hasCustody(bytes32 assetId) external view returns (bool) {
        return _custody[assetId].custody;
    }

    function getDocHashes(bytes32 assetId) external view returns (bytes32[] memory) {
        return _docsByAsset[assetId];
    }

    function getDocHash(bytes32 assetId, uint256 index) external view returns (bytes32) {
        require(index < _docsByAsset[assetId].length, "DOC_OUT_OF_RANGE");
        return _docsByAsset[assetId][index];
    }
}
