// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessRoles} from "./AccessRoles.sol";

/**
 * @title EklesiaAttestor
 * @notice Sovereign L1 attestation ledger. Records affidavit, issuance, insurance,
 *         cycle, and redemption events with immutable jurisdiction tag.
 */
contract EklesiaAttestor is AccessRoles {
    struct Attestation {
        bytes32 subjectId;
        bytes32 payloadHash;
        string clause;
        uint256 timestamp;
        address attestor;
    }

    mapping(bytes32 => Attestation) private _attestations;

    event Attested(
        bytes32 indexed attestationId,
        bytes32 indexed subjectId,
        bytes32 payloadHash,
        string jurisdiction,
        string clause,
        uint256 timestamp,
        address indexed attestor
    );

    constructor(address admin) AccessRoles(admin) {}

    function recordAttestation(
        bytes32 subjectId,
        bytes32 payloadHash,
        string calldata clause
    ) external onlyRole(ATTESTOR_ROLE) returns (bytes32 attestationId) {
        attestationId = keccak256(
            abi.encodePacked(subjectId, payloadHash, clause, block.timestamp, msg.sender)
        );

        Attestation storage slot = _attestations[attestationId];
        slot.subjectId = subjectId;
        slot.payloadHash = payloadHash;
        slot.clause = clause;
        slot.timestamp = block.timestamp;
        slot.attestor = msg.sender;

        emit Attested(
            attestationId,
            subjectId,
            payloadHash,
            JURISDICTION_TAG,
            clause,
            block.timestamp,
            msg.sender
        );
    }

    function get(bytes32 attestationId) external view returns (Attestation memory) {
        Attestation memory att = _attestations[attestationId];
        require(att.timestamp != 0, "ATTESTATION_UNKNOWN");
        return att;
    }

    function attestationExists(bytes32 attestationId) external view returns (bool) {
        return _attestations[attestationId].timestamp != 0;
    }
}
