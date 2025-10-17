// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {HRVSTToken} from "../contracts/HRVSTToken.sol";
import {CSDNInstrument} from "../contracts/CSDNInstrument.sol";
import {KycAllowlist} from "../contracts/KycAllowlist.sol";
import {CSDNRouter} from "../contracts/CSDNRouter.sol";
import {TimelockController} from "../contracts/TimelockController.sol";
import {EstateGovernor} from "../contracts/EstateGovernor.sol";
import {Roles} from "../contracts/utils/Roles.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
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
        address treasuryEscrow = vm.envAddress("TREASURY_ESCROW");
        bytes32 initialKycRoot = vm.envBytes32("INITIAL_KYC_ROOT");

        if (treasuryEscrow == address(0)) revert("TREASURY_ESCROW not set");

        string memory outputPath;
        try vm.envString("DEPLOY_OUTPUT_PATH") returns (string memory path) {
            outputPath = path;
        } catch {
            outputPath = string.concat(vm.projectRoot(), "/broadcast/devnet/generated.env");
        }

        vm.startBroadcast(deployerKey);
        HRVSTToken token = new HRVSTToken(trustee, admin);
        CSDNInstrument instrument = new CSDNInstrument("https://unified-estate.local/{id}.json", admin, trustee);
        KycAllowlist kyc = new KycAllowlist(trustee, admin, initialKycRoot);
        CSDNRouter router = new CSDNRouter(admin, instrument, kyc);
        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](0);
        TimelockController timelock = new TimelockController(vm.envUint("GOV_TIMELOCK_DELAY"), proposers, executors, admin);
        EstateGovernor governor = new EstateGovernor(
            token,
            timelock,
            vm.envUint("GOV_VOTING_DELAY"),
            vm.envUint("GOV_VOTING_PERIOD"),
            vm.envUint("GOV_PROPOSAL_THRESHOLD"),
            vm.envUint("GOV_QUORUM_BPS")
        );
        vm.stopBroadcast();

        vm.startBroadcast(adminKey);
        instrument.grantRole(Roles.CPA_ROLE, cpa);
        instrument.grantRole(Roles.TREASURY_ROLE, treasury);
        instrument.grantRole(Roles.UNDERWRITER_ROLE, underwriter);
        instrument.grantRole(Roles.ROUTER_ROLE, address(router));
        instrument.setRouter(address(router));
        router.grantRole(Roles.TREASURY_ROLE, treasury);
        router.setEscrow(treasuryEscrow);
        vm.stopBroadcast();

        vm.startBroadcast(adminKey);
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.EXECUTOR_ROLE(), address(governor));
        vm.stopBroadcast();

        console2.log("HRVSTToken", address(token));
        console2.log("CSDNInstrument", address(instrument));
        console2.log("KycAllowlist", address(kyc));
        console2.log("CSDNRouter", address(router));
        console2.log("Timelock", address(timelock));
        console2.log("Governor", address(governor));

        console2.log("Deployment output path", outputPath);
    }
}
