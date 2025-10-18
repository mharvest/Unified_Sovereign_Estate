// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {CSDNInstrument} from "../contracts/CSDNInstrument.sol";
import {CSDNRouter} from "../contracts/CSDNRouter.sol";
import {HRVSTToken} from "../contracts/HRVSTToken.sol";
import {Roles} from "../contracts/utils/Roles.sol";

contract GrantRolesAndOriginate is Script {
    function run() external {
        uint256 adminKey = vm.envUint("ADMIN_KEY");
        uint256 trusteeKey = vm.envUint("TRUSTEE_KEY");
        uint256 cpaKey = vm.envUint("CPA_KEY");
        uint256 treasuryKey = vm.envUint("TREASURY_KEY");
        uint256 underwriterKey = vm.envUint("UNDERWRITER_KEY");

        address admin = vm.addr(adminKey);
        address trustee = vm.addr(trusteeKey);
        address cpa = vm.addr(cpaKey);
        address treasury = vm.addr(treasuryKey);
        address underwriter = vm.addr(underwriterKey);
        uint256 noteId = vm.envUint("INITIAL_NOTE_ID");
        bytes32 docHash = vm.envBytes32("INITIAL_DOC_HASH");
        uint256 principal = vm.envUint("INITIAL_PRINCIPAL");

        CSDNInstrument instrument = CSDNInstrument(vm.envAddress("CSDN_ADDRESS"));
        CSDNRouter router = CSDNRouter(vm.envAddress("ROUTER_ADDRESS"));
        HRVSTToken token = HRVSTToken(vm.envAddress("HRVST_ADDRESS"));

        vm.startBroadcast(adminKey);
        instrument.grantRole(Roles.CPA_ROLE, cpa);
        instrument.grantRole(Roles.TREASURY_ROLE, treasury);
        instrument.grantRole(Roles.UNDERWRITER_ROLE, underwriter);
        router.grantRole(Roles.TREASURY_ROLE, treasury);
        vm.stopBroadcast();

        vm.startBroadcast(trusteeKey);
        token.grantRole(Roles.MINTER_ROLE, trustee);
        vm.stopBroadcast();

        vm.startBroadcast(cpaKey);
        instrument.originate(noteId, docHash, principal);
        instrument.issue(noteId);
        vm.stopBroadcast();

        console2.log("Originated note", noteId);
    }
}
