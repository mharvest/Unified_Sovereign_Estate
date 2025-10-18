// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTest} from "./BaseTest.sol";
import {Roles} from "../contracts/utils/Roles.sol";

contract RouterKycTest is BaseTest {
    function setUp() public override {
        super.setUp();
        bytes32 leaf = keccak256(abi.encodePacked(subscriber, bytes32(uint256(1))));
        vm.prank(trustee);
        kyc.setMerkleRoot(leaf);
    }

    function testSubscribeWithValidProof() public {
        vm.prank(underwriter);
        instrument.insure(NOTE_ID, PRINCIPAL);
        bytes32 leaf = keccak256(abi.encodePacked(subscriber, bytes32(uint256(1))));
        bytes32[] memory proof = new bytes32[](0);

        vm.prank(treasury);
        router.subscribeWithKyc(NOTE_ID, subscriber, PRINCIPAL, leaf, proof);

        assertEq(instrument.balanceOf(subscriber, NOTE_ID), PRINCIPAL);
    }

    function testSubscribeWithInvalidProofReverts() public {
        vm.prank(underwriter);
        instrument.insure(NOTE_ID, PRINCIPAL);
        bytes32 leaf = keccak256(abi.encodePacked(subscriber, bytes32(uint256(1))));
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = bytes32(uint256(123));

        vm.expectRevert("KYC_FAILED");
        vm.prank(treasury);
        router.subscribeWithKyc(NOTE_ID, subscriber, PRINCIPAL, leaf, proof);
    }

    function testEscrowUpdateRestrictedToAdmin() public {
        address newEscrow = address(0xBEEF);

        vm.prank(admin);
        router.setEscrow(newEscrow);
        assertEq(router.escrow(), newEscrow);

        vm.expectRevert(
            abi.encodeWithSignature(
                "AccessControlUnauthorizedAccount(address,bytes32)",
                subscriber,
                Roles.ADMIN_ROLE
            )
        );
        vm.prank(subscriber);
        router.setEscrow(subscriber);
    }
}
