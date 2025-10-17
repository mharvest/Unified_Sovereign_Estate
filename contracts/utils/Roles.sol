// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library Roles {
    bytes32 internal constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 internal constant CPA_ROLE = keccak256("CPA_ROLE");
    bytes32 internal constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 internal constant UNDERWRITER_ROLE = keccak256("UNDERWRITER_ROLE");
    bytes32 internal constant TRUSTEE_ROLE = keccak256("TRUSTEE_ROLE");
    bytes32 internal constant ROUTER_ROLE = keccak256("ROUTER_ROLE");
    bytes32 internal constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 internal constant MINTER_ROLE = keccak256("MINTER_ROLE");
}
