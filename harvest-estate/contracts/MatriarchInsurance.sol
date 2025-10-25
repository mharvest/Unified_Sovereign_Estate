// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessRoles} from "./AccessRoles.sol";

/**
 * @title MatriarchInsurance
 * @notice Maintains actuarial multiplier bands and binds coverage policies.
 */
contract MatriarchInsurance is AccessRoles {
    uint256 public constant POLICY_FLOOR_BPS = 7500;

    enum CoverageClass {
        UNKNOWN,
        REAL_ESTATE,
        INTELLECTUAL_PROPERTY,
        COMMODITIES
    }

    struct Band {
        uint256 minFactorBps;
        uint256 maxFactorBps;
    }

    struct Coverage {
        bytes32 assetId;
        CoverageClass classCode;
        uint256 factorBps;
        bytes32 disclosureHash;
        uint256 timestamp;
        address underwriter;
    }

    bytes32 public bandsDisclosureHash;
    mapping(CoverageClass => Band) private _bands;
    mapping(bytes32 => Coverage) private _coverageByBinder;

    event BandsDisclosureAnchored(bytes32 indexed disclosureHash, uint256 timestamp);
    event CoverageBound(
        bytes32 indexed binderId,
        bytes32 indexed assetId,
        CoverageClass classCode,
        uint256 factorBps,
        address indexed underwriter
    );

    constructor(
        address admin,
        bytes32 disclosureHash
    ) AccessRoles(admin) {
        _bands[CoverageClass.REAL_ESTATE] = Band(35000, 100000);
        _bands[CoverageClass.INTELLECTUAL_PROPERTY] = Band(20000, 40000);
        _bands[CoverageClass.COMMODITIES] = Band(20000, 60000);
        bandsDisclosureHash = disclosureHash;
        emit BandsDisclosureAnchored(disclosureHash, block.timestamp);
    }

    function setBand(
        CoverageClass classCode,
        uint256 minFactorBps,
        uint256 maxFactorBps
    ) external onlyRole(UNDERWRITER_ROLE) {
        require(classCode != CoverageClass.UNKNOWN, "INVALID_CLASS");
        require(minFactorBps > 0 && maxFactorBps >= minFactorBps, "INVALID_RANGE");
        _bands[classCode] = Band(minFactorBps, maxFactorBps);
    }

    function bindCoverage(
        bytes32 assetId,
        uint16 classCodeRaw,
        uint256 factorBps,
        bytes32 disclosureHash
    ) external onlyRole(UNDERWRITER_ROLE) returns (bytes32 binderId) {
        CoverageClass classCode = CoverageClass(classCodeRaw);
        Band memory band = _bands[classCode];
        require(classCode != CoverageClass.UNKNOWN, "CLASS_UNKNOWN");
        require(band.minFactorBps != 0, "BAND_UNSET");
        require(
            factorBps >= band.minFactorBps && factorBps <= band.maxFactorBps,
            "BAND_OUT_OF_RANGE"
        );

        binderId = keccak256(
            abi.encodePacked(assetId, factorBps, block.timestamp, msg.sender)
        );

        _coverageByBinder[binderId] = Coverage({
            assetId: assetId,
            classCode: classCode,
            factorBps: factorBps,
            disclosureHash: disclosureHash,
            timestamp: block.timestamp,
            underwriter: msg.sender
        });

        emit CoverageBound(binderId, assetId, classCode, factorBps, msg.sender);
    }

    function getCoverage(bytes32 binderId) external view returns (Coverage memory) {
        Coverage memory coverage = _coverageByBinder[binderId];
        require(coverage.timestamp != 0, "COVERAGE_UNKNOWN");
        return coverage;
    }

    function getBand(CoverageClass classCode) external view returns (Band memory) {
        return _bands[classCode];
    }

    function getPolicyFloorBps() external pure returns (uint256) {
        return POLICY_FLOOR_BPS;
    }
}
