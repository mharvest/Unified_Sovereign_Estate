// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessRoles} from "./AccessRoles.sol";

/**
 * @title KiiantuCycles
 * @notice Executes liquidity cycles and records treasury cadence.
 */
contract KiiantuCycles is AccessRoles {
    struct Cycle {
        uint256 noteId;
        uint16 tenorDays;
        uint16 rateBps;
        uint256 timestamp;
        address operator;
    }

    mapping(bytes32 => Cycle) private _cycles;

    event CycleExecuted(
        bytes32 indexed cycleId,
        uint256 indexed noteId,
        uint16 tenorDays,
        uint16 rateBps,
        uint256 timestamp,
        address indexed operator
    );

    constructor(address admin) AccessRoles(admin) {}

    function runCycle(
        uint256 noteId,
        uint16 days_,
        uint16 rateBps
    ) external onlyRole(TRUSTEE_ROLE) returns (bytes32 cycleId) {
        require(days_ > 0, "INVALID_TENOR");
        cycleId = keccak256(abi.encodePacked(noteId, days_, rateBps, block.timestamp, msg.sender));
        _cycles[cycleId] = Cycle({
            noteId: noteId,
            tenorDays: days_,
            rateBps: rateBps,
            timestamp: block.timestamp,
            operator: msg.sender
        });
        emit CycleExecuted(cycleId, noteId, days_, rateBps, block.timestamp, msg.sender);
    }

    function getCycle(bytes32 cycleId) external view returns (Cycle memory) {
        Cycle memory cycle = _cycles[cycleId];
        require(cycle.timestamp != 0, "CYCLE_UNKNOWN");
        return cycle;
    }
}
