// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTest} from "./BaseTest.sol";
import {CSDNInstrument} from "../contracts/CSDNInstrument.sol";

contract OracleIntegrationTest is BaseTest {
    function testEventsProvideOraclePayload() public {
        vm.prank(underwriter);
        instrument.insure(NOTE_ID, PRINCIPAL);

        vm.prank(treasury);
        instrument.subscribe(NOTE_ID, subscriber, PRINCIPAL);

        vm.prank(treasury);
        instrument.markDistribution(NOTE_ID, subscriber, PRINCIPAL);
    }
}
