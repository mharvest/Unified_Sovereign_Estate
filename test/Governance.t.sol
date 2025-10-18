// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTest} from "./BaseTest.sol";
import {EstateGovernor} from "../contracts/EstateGovernor.sol";
import {TimelockController} from "../contracts/TimelockController.sol";
import {Roles} from "../contracts/utils/Roles.sol";

contract GovernanceTest is BaseTest {
    EstateGovernor internal governor;
    TimelockController internal timelock;
    address internal voter = address(0xBEEF);

    function setUp() public override {
        super.setUp();

        address[] memory proposers = new address[](1);
        proposers[0] = admin;
        address[] memory executors = new address[](1);
        executors[0] = admin;
        timelock = new TimelockController(2 days, proposers, executors, admin);
        governor = new EstateGovernor(token, timelock, 1, 5, 0, 2000);

        vm.startPrank(admin);
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.EXECUTOR_ROLE(), address(0));
        instrument.grantRole(Roles.TRUSTEE_ROLE, address(timelock));
        vm.stopPrank();

        vm.startPrank(trustee);
        token.mint(voter, 1_000_000 ether);
        vm.stopPrank();

        vm.prank(voter);
        token.delegate(voter);
    }

    function testGovernanceCanPauseInstrument() public {
        address[] memory targets = new address[](1);
        targets[0] = address(instrument);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("pause()");
        string memory description = "Pause instrument for audit";

        vm.prank(voter);
        uint256 proposalId = governor.propose(targets, values, calldatas, description);

        vm.roll(block.number + governor.votingDelay() + 1);

        vm.prank(voter);
        governor.castVote(proposalId, 1);

        vm.roll(block.number + governor.votingPeriod() + 1);

        bytes32 descriptionHash = keccak256(bytes(description));
        governor.queue(targets, values, calldatas, descriptionHash);

        vm.warp(block.timestamp + 2 days + 1);
        governor.execute(targets, values, calldatas, descriptionHash);

        assertTrue(instrument.paused());
    }
}
