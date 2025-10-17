// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Roles} from "./utils/Roles.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

contract HRVSTToken is ERC20, ERC20Permit, ERC20Votes, AccessControl {
    constructor(address trustee, address admin) ERC20("Harvest Governance Token", "HRVST") ERC20Permit("Harvest Governance Token") {
        _grantRole(Roles.TRUSTEE_ROLE, trustee);
        _grantRole(Roles.ADMIN_ROLE, admin);
        _setRoleAdmin(Roles.MINTER_ROLE, Roles.TRUSTEE_ROLE);
        _setRoleAdmin(Roles.TRUSTEE_ROLE, Roles.ADMIN_ROLE);
        _setRoleAdmin(Roles.ADMIN_ROLE, Roles.ADMIN_ROLE);
        _grantRole(Roles.MINTER_ROLE, trustee);
    }

    function mint(address to, uint256 amount) external onlyRole(Roles.MINTER_ROLE) {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
