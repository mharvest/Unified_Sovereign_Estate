// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISafeVault {
    event DocumentStored(bytes32 indexed docHash, string uri);

    function storeDocument(bytes32 docHash, string calldata uri) external;

    function hasDocument(bytes32 docHash) external view returns (bool);
}
