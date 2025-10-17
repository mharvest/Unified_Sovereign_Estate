// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {HRVSTToken} from "../contracts/HRVSTToken.sol";
import {CSDNInstrument} from "../contracts/CSDNInstrument.sol";
import {KycAllowlist} from "../contracts/KycAllowlist.sol";
import {CSDNRouter} from "../contracts/CSDNRouter.sol";
import {Roles} from "../contracts/utils/Roles.sol";

contract BaseTest is Test {
    HRVSTToken internal token;
    CSDNInstrument internal instrument;
    KycAllowlist internal kyc;
    CSDNRouter internal router;

    address internal admin = address(0xA11CE);
    address internal trustee = address(0x7BEEF);
    address internal cpa = address(0xC1A);
    address internal treasury = address(0x7100);
    address internal underwriter = address(0x5E7);
    address internal subscriber = address(0x515E);

    uint256 internal constant NOTE_ID = 1;
    uint256 internal constant PRINCIPAL = 1_000 ether;
    bytes32 internal constant DOC_HASH = keccak256("Haskins-Note");

    function setUp() public virtual {
        token = new HRVSTToken(trustee, admin);
        instrument = new CSDNInstrument("https://unified-estate.local/{id}.json", admin, trustee);
        kyc = new KycAllowlist(trustee, admin, bytes32(0));
        router = new CSDNRouter(admin, instrument, kyc);

        vm.startPrank(admin);
        instrument.grantRole(Roles.CPA_ROLE, cpa);
        instrument.grantRole(Roles.TREASURY_ROLE, treasury);
        instrument.grantRole(Roles.UNDERWRITER_ROLE, underwriter);
        instrument.grantRole(Roles.ROUTER_ROLE, address(router));
        instrument.setRouter(address(router));
        router.grantRole(Roles.TREASURY_ROLE, treasury);
        vm.stopPrank();

        vm.prank(cpa);
        instrument.originate(NOTE_ID, DOC_HASH, PRINCIPAL);
        vm.prank(cpa);
        instrument.issue(NOTE_ID);
    }
}
