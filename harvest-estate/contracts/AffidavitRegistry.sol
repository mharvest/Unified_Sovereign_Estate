// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessRoles} from "./AccessRoles.sol";

/**
 * @title AffidavitRegistry (Eyeion)
 * @notice Stores legal affidavits hashed on-chain, referenced by assetId.
 */
contract AffidavitRegistry is AccessRoles {
    struct Affidavit {
        bytes32 assetId;
        bytes32 documentHash;
        address witness;
        uint256 timestamp;
        bytes metadata; // raw JSON payload for off-chain reconstruction
    }

    mapping(bytes32 => Affidavit) private _affidavits;
    mapping(bytes32 => bytes32) private _latestByAsset;

    event AffidavitCreated(
        bytes32 indexed affidavitId,
        bytes32 indexed assetId,
        bytes32 documentHash,
        address indexed witness,
        uint256 timestamp
    );

    constructor(address admin) AccessRoles(admin) {}

    function createAffidavit(
        bytes32 assetId,
        bytes calldata meta
    ) external onlyRole(ATTESTOR_ROLE) returns (bytes32 affidavitId) {
        require(assetId != bytes32(0), "INVALID_ASSET");
        bytes32 docHash = keccak256(meta);
        affidavitId = keccak256(
            abi.encodePacked(assetId, docHash, block.timestamp, msg.sender)
        );

        Affidavit storage slot = _affidavits[affidavitId];
        slot.assetId = assetId;
        slot.documentHash = docHash;
        slot.witness = msg.sender;
        slot.timestamp = block.timestamp;
        slot.metadata = meta;

        _latestByAsset[assetId] = affidavitId;

        emit AffidavitCreated(
            affidavitId,
            assetId,
            docHash,
            msg.sender,
            block.timestamp
        );
    }

    function getAffidavit(bytes32 affidavitId) external view returns (Affidavit memory) {
        Affidavit memory affidavit = _affidavits[affidavitId];
        require(affidavit.timestamp != 0, "AFFIDAVIT_UNKNOWN");
        return affidavit;
    }

    function latestAffidavit(bytes32 assetId) external view returns (bytes32) {
        return _latestByAsset[assetId];
    }

    function affidavitExists(bytes32 affidavitId) external view returns (bool) {
        return _affidavits[affidavitId].timestamp != 0;
    }
}
