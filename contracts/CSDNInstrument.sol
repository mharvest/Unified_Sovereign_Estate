// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {Roles} from "./utils/Roles.sol";

contract CSDNInstrument is ERC1155, ERC1155Supply, AccessControl, Pausable, ReentrancyGuard {
    enum Lifecycle {
        None,
        Originated,
        Issued,
        Insured,
        Subscribed,
        DistributionReady,
        Redeemed
    }

    struct Note {
        Lifecycle state;
        bytes32 docHash;
        uint256 principal;
        uint256 insuredAmount;
        uint256 subscribedAmount;
        uint256 redeemedAmount;
    }

    mapping(uint256 => Note) private notes;
    mapping(uint256 => mapping(address => uint256)) public distributions;

    event Originated(uint256 indexed noteId, bytes32 indexed docHash, uint256 principal, address indexed originator);
    event Issued(uint256 indexed noteId, address indexed issuer);
    event Insured(uint256 indexed noteId, uint256 insuredAmount, address indexed underwriter);
    event Subscribed(uint256 indexed noteId, address indexed lp, uint256 amount, address indexed operator);
    event DistributionMarked(uint256 indexed noteId, address indexed lp, uint256 amount, address indexed executor);
    event Redeemed(uint256 indexed noteId, address indexed lp, uint256 amount, address indexed executor);
    event DocHashUpdated(uint256 indexed noteId, bytes32 indexed docHash, address indexed updater);
    event RouterSet(address indexed newRouter);

    address public router;

    modifier onlyRoleOrRouter(bytes32 role) {
        require(hasRole(role, msg.sender) || msg.sender == router, "MISSING_ROLE_OR_ROUTER");
        _;
    }

    constructor(string memory uri_, address admin, address trustee) ERC1155(uri_) {
        _grantRole(Roles.ADMIN_ROLE, admin);
        _grantRole(Roles.TRUSTEE_ROLE, trustee);
        _setRoleAdmin(Roles.CPA_ROLE, Roles.ADMIN_ROLE);
        _setRoleAdmin(Roles.TREASURY_ROLE, Roles.ADMIN_ROLE);
        _setRoleAdmin(Roles.UNDERWRITER_ROLE, Roles.ADMIN_ROLE);
        _setRoleAdmin(Roles.TRUSTEE_ROLE, Roles.ADMIN_ROLE);
        _setRoleAdmin(Roles.ROUTER_ROLE, Roles.ADMIN_ROLE);
        _setRoleAdmin(Roles.ADMIN_ROLE, Roles.ADMIN_ROLE);
    }

    function setRouter(address newRouter) external onlyRole(Roles.ADMIN_ROLE) {
        router = newRouter;
        emit RouterSet(newRouter);
    }

    function pause() external onlyRole(Roles.TRUSTEE_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Roles.TRUSTEE_ROLE) {
        _unpause();
    }

    function originate(uint256 noteId, bytes32 documentHash, uint256 principal) external whenNotPaused onlyRole(Roles.CPA_ROLE) {
        Note storage note = notes[noteId];
        require(note.state == Lifecycle.None, "NOTE_EXISTS");
        require(principal > 0, "INVALID_PRINCIPAL");

        note.state = Lifecycle.Originated;
        note.docHash = documentHash;
        note.principal = principal;

        emit Originated(noteId, documentHash, principal, msg.sender);
    }

    function updateDocumentHash(uint256 noteId, bytes32 newHash) external whenNotPaused onlyRole(Roles.CPA_ROLE) {
        Note storage note = notes[noteId];
        require(note.state != Lifecycle.None, "NOTE_UNKNOWN");
        note.docHash = newHash;
        emit DocHashUpdated(noteId, newHash, msg.sender);
    }

    function issue(uint256 noteId) external whenNotPaused onlyRole(Roles.CPA_ROLE) {
        Note storage note = notes[noteId];
        require(note.state == Lifecycle.Originated, "INVALID_STATE_ISSUE");
        note.state = Lifecycle.Issued;
        emit Issued(noteId, msg.sender);
    }

    function insure(uint256 noteId, uint256 coverAmount) external whenNotPaused onlyRole(Roles.UNDERWRITER_ROLE) {
        Note storage note = notes[noteId];
        require(note.state == Lifecycle.Issued, "INVALID_STATE_INSURE");
        require(coverAmount > 0, "INVALID_COVER");
        note.state = Lifecycle.Insured;
        note.insuredAmount = coverAmount;
        emit Insured(noteId, coverAmount, msg.sender);
    }

    function subscribe(uint256 noteId, address lp, uint256 amount) external whenNotPaused onlyRoleOrRouter(Roles.TREASURY_ROLE) nonReentrant {
        Note storage note = notes[noteId];
        require(note.state == Lifecycle.Insured || note.state == Lifecycle.Subscribed, "INVALID_STATE_SUBSCRIBE");
        require(lp != address(0), "INVALID_LP");
        require(amount > 0, "INVALID_AMOUNT");
        uint256 newSubscribed = note.subscribedAmount + amount;
        require(newSubscribed <= note.principal, "OVER_SUBSCRIBE");

        note.state = newSubscribed == note.principal ? Lifecycle.Subscribed : Lifecycle.Insured;
        note.subscribedAmount = newSubscribed;

        _mint(lp, noteId, amount, "");
        emit Subscribed(noteId, lp, amount, msg.sender);
    }

    function markDistribution(uint256 noteId, address lp, uint256 amount) external whenNotPaused onlyRole(Roles.TREASURY_ROLE) nonReentrant {
        Note storage note = notes[noteId];
        require(note.state == Lifecycle.Subscribed || note.state == Lifecycle.DistributionReady, "INVALID_STATE_DISTRIBUTION");
        require(amount > 0, "INVALID_DISTRIBUTION");
        distributions[noteId][lp] += amount;
        note.state = Lifecycle.DistributionReady;
        emit DistributionMarked(noteId, lp, amount, msg.sender);
    }

    function redeem(uint256 noteId, uint256 amount) external whenNotPaused nonReentrant {
        Note storage note = notes[noteId];
        require(note.state == Lifecycle.DistributionReady, "INVALID_STATE_REDEEM");
        require(amount > 0, "INVALID_REDEEM_AMOUNT");
        uint256 balance = balanceOf(msg.sender, noteId);
        require(balance >= amount, "INSUFFICIENT_BALANCE");

        note.redeemedAmount += amount;
        if (note.redeemedAmount == note.principal) {
            note.state = Lifecycle.Redeemed;
        }

        _burn(msg.sender, noteId, amount);
        emit Redeemed(noteId, msg.sender, amount, msg.sender);
    }

    function getNote(uint256 noteId) external view returns (Note memory) {
        return notes[noteId];
    }

    function stateOf(uint256 noteId) external view returns (Lifecycle) {
        return notes[noteId].state;
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory amounts) internal override(ERC1155, ERC1155Supply) whenNotPaused {
        super._update(from, to, ids, amounts);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

}
