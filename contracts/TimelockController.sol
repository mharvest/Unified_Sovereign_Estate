// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TimelockController as OZTimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

contract TimelockController is OZTimelockController {
    constructor(uint256 minDelay, address[] memory proposers, address[] memory executors, address admin) OZTimelockController(minDelay, proposers, executors, admin) {
        // no-op: rely on OZ constructor for role assignments
    }
}
