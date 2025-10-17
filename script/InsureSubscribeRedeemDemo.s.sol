// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {CSDNInstrument} from "../contracts/CSDNInstrument.sol";
import {CSDNRouter} from "../contracts/CSDNRouter.sol";
import {KycAllowlist} from "../contracts/KycAllowlist.sol";
import {HRVSTToken} from "../contracts/HRVSTToken.sol";

contract InsureSubscribeRedeemDemo is Script {
    function run() external {
        uint256 noteId = vm.envUint("DEMO_NOTE_ID");
        uint256 coverAmount = vm.envUint("DEMO_COVER_AMOUNT");
        uint256 subscribeAmount = vm.envUint("DEMO_SUBSCRIBE_AMOUNT");
        uint256 distributionAmount = vm.envUint("DEMO_DISTRIBUTION_AMOUNT");

        uint256 trusteeKey = vm.envUint("TRUSTEE_KEY");
        uint256 underwriterKey = vm.envUint("UNDERWRITER_KEY");
        uint256 treasuryKey = vm.envUint("TREASURY_KEY");
        uint256 subscriberKey = vm.envUint("SUBSCRIBER_KEY");

        address trustee = vm.addr(trusteeKey);
        address underwriter = vm.addr(underwriterKey);
        address treasury = vm.addr(treasuryKey);
        address subscriber = vm.addr(subscriberKey);
        bytes32 subscriberSalt = vm.envBytes32("SUBSCRIBER_SALT");

        CSDNInstrument instrument = CSDNInstrument(vm.envAddress("CSDN_ADDRESS"));
        CSDNRouter router = CSDNRouter(vm.envAddress("ROUTER_ADDRESS"));
        KycAllowlist kyc = KycAllowlist(vm.envAddress("KYC_ADDRESS"));
        HRVSTToken token = HRVSTToken(vm.envAddress("HRVST_ADDRESS"));

        bytes32 leaf = keccak256(abi.encodePacked(subscriber, subscriberSalt));

        vm.startBroadcast(trusteeKey);
        kyc.setMerkleRoot(leaf);
        token.mint(treasury, subscribeAmount);
        vm.stopBroadcast();

        vm.startBroadcast(underwriterKey);
        instrument.insure(noteId, coverAmount);
        vm.stopBroadcast();

        vm.startBroadcast(treasuryKey);
        bytes32[] memory proof = new bytes32[](0);
        router.subscribeWithKyc(noteId, subscriber, subscribeAmount, leaf, proof);
        instrument.markDistribution(noteId, subscriber, distributionAmount);
        vm.stopBroadcast();

        vm.startBroadcast(subscriberKey);
        instrument.redeem(noteId, distributionAmount);
        vm.stopBroadcast();

        console2.log("Demo lifecycle complete for note", noteId);
    }
}
