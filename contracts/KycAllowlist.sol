// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Roles} from "./utils/Roles.sol";

interface ISemaphoreVerifier {
    function verifyProof(uint256 merkleTreeRoot, uint256 signalHash, uint256 nullifierHash, uint256 externalNullifier, uint256[8] calldata proof) external view returns (bool);
}

contract KycAllowlist is AccessControl {
    bytes32 public merkleRoot;
    ISemaphoreVerifier public semaphoreVerifier;

    event MerkleRootUpdated(bytes32 indexed newRoot, address indexed updater);
    event SemaphoreVerifierUpdated(address indexed verifier);

    constructor(address trustee, address admin, bytes32 initialRoot) {
        _grantRole(Roles.TRUSTEE_ROLE, trustee);
        _grantRole(Roles.ADMIN_ROLE, admin);
        _setRoleAdmin(Roles.TRUSTEE_ROLE, Roles.ADMIN_ROLE);
        _setRoleAdmin(Roles.ADMIN_ROLE, Roles.ADMIN_ROLE);
        merkleRoot = initialRoot;
    }

    function setMerkleRoot(bytes32 newRoot) external onlyRole(Roles.TRUSTEE_ROLE) {
        merkleRoot = newRoot;
        emit MerkleRootUpdated(newRoot, msg.sender);
    }

    function setSemaphoreVerifier(ISemaphoreVerifier newVerifier) external onlyRole(Roles.TRUSTEE_ROLE) {
        semaphoreVerifier = newVerifier;
        emit SemaphoreVerifierUpdated(address(newVerifier));
    }

    function verify(bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        if (merkleRoot == bytes32(0)) {
            return false;
        }
        return MerkleProof.verify(proof, merkleRoot, leaf);
    }

    function isVerified(bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        return this.verify(leaf, proof);
    }
}
