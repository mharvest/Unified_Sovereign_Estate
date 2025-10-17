// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTest} from "./BaseTest.sol";
import {CSDNInstrument} from "../contracts/CSDNInstrument.sol";
import {Roles} from "../contracts/utils/Roles.sol";

contract CSDNTest is BaseTest {
    function testLifecycleHappyPath() public {
        vm.prank(underwriter);
        instrument.insure(NOTE_ID, PRINCIPAL);
        assertEq(uint8(instrument.stateOf(NOTE_ID)), uint8(CSDNInstrument.Lifecycle.Insured));

        vm.prank(treasury);
        instrument.subscribe(NOTE_ID, subscriber, PRINCIPAL);
        assertEq(uint8(instrument.stateOf(NOTE_ID)), uint8(CSDNInstrument.Lifecycle.Subscribed));
        assertEq(instrument.balanceOf(subscriber, NOTE_ID), PRINCIPAL);

        vm.prank(treasury);
        instrument.markDistribution(NOTE_ID, subscriber, PRINCIPAL);
        assertEq(uint8(instrument.stateOf(NOTE_ID)), uint8(CSDNInstrument.Lifecycle.DistributionReady));

        vm.prank(subscriber);
        instrument.redeem(NOTE_ID, PRINCIPAL);
        assertEq(uint8(instrument.stateOf(NOTE_ID)), uint8(CSDNInstrument.Lifecycle.Redeemed));
        assertEq(instrument.balanceOf(subscriber, NOTE_ID), 0);
    }

    function testCannotRedeemBeforeDistribution() public {
        vm.prank(underwriter);
        instrument.insure(NOTE_ID, PRINCIPAL);
        vm.prank(treasury);
        instrument.subscribe(NOTE_ID, subscriber, PRINCIPAL);

        vm.expectRevert("INVALID_STATE_REDEEM");
        vm.prank(subscriber);
        instrument.redeem(NOTE_ID, PRINCIPAL);
    }

    function testSubscribeOverPrincipalReverts() public {
        vm.prank(underwriter);
        instrument.insure(NOTE_ID, PRINCIPAL / 2);
        vm.expectRevert("OVER_SUBSCRIBE");
        vm.prank(treasury);
        instrument.subscribe(NOTE_ID, subscriber, PRINCIPAL + 1);
    }

    function testPartialRedemptionKeepsDistributionState() public {
        vm.prank(underwriter);
        instrument.insure(NOTE_ID, PRINCIPAL);

        vm.prank(treasury);
        instrument.subscribe(NOTE_ID, subscriber, PRINCIPAL);

        vm.prank(treasury);
        instrument.markDistribution(NOTE_ID, subscriber, PRINCIPAL);

        vm.prank(subscriber);
        instrument.redeem(NOTE_ID, PRINCIPAL / 2);

        assertEq(uint8(instrument.stateOf(NOTE_ID)), uint8(CSDNInstrument.Lifecycle.DistributionReady));
        assertEq(instrument.balanceOf(subscriber, NOTE_ID), PRINCIPAL / 2);
    }

    function testDocHashUpdateRestrictedToCpa() public {
        vm.prank(underwriter);
        instrument.insure(NOTE_ID, PRINCIPAL);

        bytes32 newHash = keccak256("new-doc");

        vm.prank(cpa);
        instrument.updateDocumentHash(NOTE_ID, newHash);
        assertEq(instrument.getNote(NOTE_ID).docHash, newHash);

        vm.expectRevert(abi.encodeWithSignature("AccessControlUnauthorizedAccount(address,bytes32)", subscriber, Roles.CPA_ROLE));
        vm.prank(subscriber);
        instrument.updateDocumentHash(NOTE_ID, DOC_HASH);
    }
}
