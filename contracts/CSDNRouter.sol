// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Roles} from "./utils/Roles.sol";
import {KycAllowlist} from "./KycAllowlist.sol";
import {CSDNInstrument} from "./CSDNInstrument.sol";

contract CSDNRouter is AccessControl {
    CSDNInstrument public immutable csdn; // forge-lint: disable-line screaming-snake-case-immutable
    KycAllowlist public kyc;

    event KYCSubscribed(address indexed lp, uint256 indexed noteId, uint256 amount, bytes32 leaf, address escrow);
    event KycAllowlistUpdated(address indexed kycContract);
    event EscrowSet(address indexed escrowAddress);

    address public escrow;

    constructor(address admin, CSDNInstrument csdnInstrument, KycAllowlist kycContract) {
        csdn = csdnInstrument;
        kyc = kycContract;
        escrow = admin;
        _grantRole(Roles.ADMIN_ROLE, admin);
        _setRoleAdmin(Roles.TREASURY_ROLE, Roles.ADMIN_ROLE);
        _setRoleAdmin(Roles.ADMIN_ROLE, Roles.ADMIN_ROLE);
        _grantRole(Roles.TREASURY_ROLE, admin);
    }

    function setEscrow(address newEscrow) external onlyRole(Roles.ADMIN_ROLE) {
        escrow = newEscrow;
        emit EscrowSet(newEscrow);
    }

    function setKycAllowlist(KycAllowlist newAllowlist) external onlyRole(Roles.ADMIN_ROLE) {
        kyc = newAllowlist;
        emit KycAllowlistUpdated(address(newAllowlist));
    }

    function subscribeWithKyc(uint256 noteId, address lp, uint256 amount, bytes32 leaf, bytes32[] calldata proof) external onlyRole(Roles.TREASURY_ROLE) {
        require(kyc.verify(leaf, proof), "KYC_FAILED");
        require(lp != address(0), "INVALID_LP");
        csdn.subscribe(noteId, lp, amount);
        emit KYCSubscribed(lp, noteId, amount, leaf, escrow);
    }
}
