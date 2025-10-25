// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessRoles} from "./AccessRoles.sol";
import {SafeVault} from "./SafeVault.sol";
import {AffidavitRegistry} from "./AffidavitRegistry.sol";
import {AnimaOS} from "./AnimaOS.sol";

/**
 * @title VaultQuant
 * @notice Controls issuance and NAV accounting for CSDN/SDN instruments.
 */
contract VaultQuant is AccessRoles {
    enum InstrumentType {
        NONE,
        CSDN,
        SDN
    }

    struct Note {
        bytes32 assetId;
        InstrumentType instrumentType;
        uint256 par;
        uint256 nav;
        bytes32 affidavitId;
        bytes32 attestationId;
        bool active;
    }

    SafeVault public immutable safeVault;
    AffidavitRegistry public immutable affidavitRegistry;
    AnimaOS public immutable anima;

    uint256 public nextNoteId = 1;
    mapping(uint256 => Note) private _notes;
    mapping(bytes32 => uint256) private _assetNav;

    uint256 private _aggregateCsdnNav;
    uint256 private _aggregateSdnNav;

    bytes32 public constant ACTION_ISSUANCE = keccak256("ISSUANCE");
    bytes32 public constant ACTION_NAV_UPDATE = keccak256("NAV_UPDATE");
    bytes32 public constant ACTION_REDEMPTION = keccak256("REDEMPTION");

    event AssetNavSet(bytes32 indexed assetId, uint256 nav, address indexed actor);
    event InstrumentIssued(
        uint256 indexed noteId,
        bytes32 indexed assetId,
        InstrumentType instrumentType,
        uint256 par,
        uint256 nav,
        bytes32 affidavitId
    );
    event InstrumentRedeemed(uint256 indexed noteId, uint256 amount, uint256 remainingNav);
    event NoteNavUpdated(uint256 indexed noteId, uint256 updatedNav);

    constructor(
        address admin,
        SafeVault safeVault_,
        AffidavitRegistry affidavitRegistry_,
        AnimaOS anima_
    ) AccessRoles(admin) {
        require(address(safeVault_) != address(0), "SAFEVAULT_REQ");
        require(address(affidavitRegistry_) != address(0), "AFFIDAVIT_REQ");
        require(address(anima_) != address(0), "ANIMA_REQ");
        safeVault = safeVault_;
        affidavitRegistry = affidavitRegistry_;
        anima = anima_;
    }

    function setAssetNAV(bytes32 assetId, uint256 navWei) external onlyRole(CPA_ROLE) {
        _assetNav[assetId] = navWei;
        emit AssetNavSet(assetId, navWei, msg.sender);
    }

    function issueCSDN(bytes32 assetId, uint256 par) external onlyRole(TRUSTEE_ROLE) returns (uint256) {
        return _issueInstrument(assetId, par, InstrumentType.CSDN);
    }

    function issueSDN(bytes32 assetId, uint256 par) external onlyRole(TRUSTEE_ROLE) returns (uint256) {
        return _issueInstrument(assetId, par, InstrumentType.SDN);
    }

    function _issueInstrument(
        bytes32 assetId,
        uint256 par,
        InstrumentType instrumentType
    ) internal returns (uint256 noteId) {
        require(par > 0, "INVALID_PAR");
        require(safeVault.hasCustody(assetId), "CUSTODY_REQUIRED");

        bytes32 affidavitId = affidavitRegistry.latestAffidavit(assetId);
        require(affidavitId != bytes32(0), "AFFIDAVIT_REQUIRED");
        require(anima.ok(assetId, ACTION_ISSUANCE), "ANIMA_BLOCKED");

        uint256 navWei = _assetNav[assetId];
        require(navWei > 0, "NAV_REQUIRED");

        noteId = nextNoteId++;
        _notes[noteId] = Note({
            assetId: assetId,
            instrumentType: instrumentType,
            par: par,
            nav: navWei,
            affidavitId: affidavitId,
            attestationId: bytes32(0),
            active: true
        });

        if (instrumentType == InstrumentType.CSDN) {
            _aggregateCsdnNav += navWei;
        } else {
            _aggregateSdnNav += navWei;
        }

        emit InstrumentIssued(noteId, assetId, instrumentType, par, navWei, affidavitId);
    }

    function updateNoteAttestation(uint256 noteId, bytes32 attestationId) external onlyRole(ATTESTOR_ROLE) {
        Note storage note = _getActiveNote(noteId);
        note.attestationId = attestationId;
    }

    function updateNoteNAV(uint256 noteId, uint256 navWei) external onlyRole(CPA_ROLE) {
        Note storage note = _getActiveNote(noteId);
        require(anima.ok(note.assetId, ACTION_NAV_UPDATE), "ANIMA_BLOCKED");

        if (note.instrumentType == InstrumentType.CSDN) {
            _aggregateCsdnNav = _aggregateCsdnNav - note.nav + navWei;
        } else {
            _aggregateSdnNav = _aggregateSdnNav - note.nav + navWei;
        }

        note.nav = navWei;
        emit NoteNavUpdated(noteId, navWei);
    }

    function settleRedemption(uint256 noteId, uint256 amount) external onlyRole(TRUSTEE_ROLE) {
        Note storage note = _getActiveNote(noteId);
        require(amount > 0, "INVALID_AMOUNT");
        require(amount <= note.nav, "AMOUNT_TOO_HIGH");
        require(anima.ok(note.assetId, ACTION_REDEMPTION), "ANIMA_BLOCKED");

        note.nav -= amount;
        if (note.instrumentType == InstrumentType.CSDN) {
            _aggregateCsdnNav -= amount;
        } else {
            _aggregateSdnNav -= amount;
        }

        if (note.nav == 0) {
            note.active = false;
        }

        emit InstrumentRedeemed(noteId, amount, note.nav);
    }

    function getAggregateNAV() external view returns (uint256 navCsdn, uint256 navSdn) {
        return (_aggregateCsdnNav, _aggregateSdnNav);
    }

    function getNote(uint256 noteId) external view returns (Note memory) {
        return _notes[noteId];
    }

    function _getActiveNote(uint256 noteId) internal view returns (Note storage) {
        Note storage note = _notes[noteId];
        require(note.active, "NOTE_INACTIVE");
        return note;
    }
}
