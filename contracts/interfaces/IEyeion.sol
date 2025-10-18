// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IEyeion {
    function registerDocument(bytes32 documentHash, bytes calldata payload) external;

    function appendVerification(bytes32 documentHash, bytes calldata payload) external;
}
