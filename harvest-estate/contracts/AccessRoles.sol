// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title AccessRoles
 * @notice Minimal role-based access control shared across sovereign stack contracts.
 *         All privileged calls route through these role gates. Admins may delegate additional
 *         trustees/attestors/underwriters/CPA signers as required.
 */
abstract contract AccessRoles {
    string public constant JURISDICTION_TAG =
        "UHMI 508(c)(1)(a); Cheroenhaka (Nottoway) Treaty 1713";

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant TRUSTEE_ROLE = keccak256("TRUSTEE_ROLE");
    bytes32 public constant ATTESTOR_ROLE = keccak256("ATTESTOR_ROLE");
    bytes32 public constant UNDERWRITER_ROLE = keccak256("UNDERWRITER_ROLE");
    bytes32 public constant CPA_ROLE = keccak256("CPA_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    mapping(bytes32 => mapping(address => bool)) private _roles;

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    modifier onlyRole(bytes32 role) {
        require(hasRole(role, msg.sender), "ACCESS_DENIED");
        _;
    }

    constructor(address admin) {
        require(admin != address(0), "INVALID_ADMIN");
        _grantRole(ADMIN_ROLE, admin);
    }

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    function grantRole(bytes32 role, address account) public onlyRole(ADMIN_ROLE) {
        _grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) public onlyRole(ADMIN_ROLE) {
        require(_roles[role][account], "NO_ROLE");
        delete _roles[role][account];
        emit RoleRevoked(role, account, msg.sender);
    }

    function _grantRole(bytes32 role, address account) internal {
        require(account != address(0), "INVALID_ACCOUNT");
        if (!_roles[role][account]) {
            _roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }
}
