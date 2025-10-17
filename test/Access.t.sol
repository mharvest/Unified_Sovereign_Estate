// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTest} from "./BaseTest.sol";

contract AccessTest is BaseTest {
    function testOnlyTrusteeCanPause() public {
        vm.expectRevert();
        vm.prank(treasury);
        instrument.pause();

        vm.prank(trustee);
        instrument.pause();
        assertTrue(instrument.paused());
    }

    function testSubscribeRequiresRoleOrRouter() public {
        vm.prank(trustee);
        instrument.pause();

        vm.expectRevert();
        vm.prank(treasury);
        instrument.subscribe(NOTE_ID, subscriber, 1);

        vm.prank(trustee);
        instrument.unpause();

        vm.expectRevert("MISSING_ROLE_OR_ROUTER");
        vm.prank(subscriber);
        instrument.subscribe(NOTE_ID, subscriber, 1);
    }
}
