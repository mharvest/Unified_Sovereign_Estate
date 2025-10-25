// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../contracts/AccessRoles.sol";
import "../contracts/EklesiaAttestor.sol";
import "../contracts/AffidavitRegistry.sol";
import "../contracts/SafeVault.sol";
import "../contracts/VaultQuant.sol";
import "../contracts/MatriarchInsurance.sol";
import "../contracts/HRVST.sol";
import "../contracts/KiiantuCycles.sol";
import "../contracts/AnimaOS.sol";
import "./BaseTest.sol";

contract SovereignStackTest is BaseTest {
    address internal constant TRUSTEE = address(0x1);
    address internal constant ATTESTOR = address(0x2);
    address internal constant UNDERWRITER = address(0x3);
    address internal constant CPA = address(0x4);
    address internal constant GOVERNANCE = address(0x5);

    bytes32 internal constant ASSET_ID = keccak256(abi.encodePacked("HASKINS-16315"));
    bytes32 internal constant ACTION_ISSUANCE = keccak256("ISSUANCE");
    bytes32 internal constant ACTION_REDEMPTION = keccak256("REDEMPTION");

    EklesiaAttestor private eklesia;
    AffidavitRegistry private affidavitRegistry;
    SafeVault private safeVault;
    AnimaOS private anima;
    VaultQuant private vaultQuant;
    MatriarchInsurance private matriarch;
    HRVST private hrvs;
    KiiantuCycles private kianitu;

    constructor() {
        eklesia = new EklesiaAttestor(address(this));
        affidavitRegistry = new AffidavitRegistry(address(this));
        safeVault = new SafeVault(address(this));
        anima = new AnimaOS(address(this));
        vaultQuant = new VaultQuant(address(this), safeVault, affidavitRegistry, anima);
        matriarch = new MatriarchInsurance(
            address(this),
            keccak256("ACTUARIAL_DISCLOSURE_V1")
        );
        hrvs = new HRVST(address(this), matriarch.POLICY_FLOOR_BPS());
        kianitu = new KiiantuCycles(address(this));

        _seedRoles();
    }

    function _seedRoles() internal {
        safeVault.grantRole(safeVault.TRUSTEE_ROLE(), TRUSTEE);
        safeVault.grantRole(safeVault.TRUSTEE_ROLE(), address(this));

        // Registry & Eklesia roles
        affidavitRegistry.grantRole(affidavitRegistry.ATTESTOR_ROLE(), ATTESTOR);
        affidavitRegistry.grantRole(affidavitRegistry.ATTESTOR_ROLE(), address(this));
        eklesia.grantRole(eklesia.ATTESTOR_ROLE(), ATTESTOR);
        eklesia.grantRole(eklesia.ATTESTOR_ROLE(), address(this));

        // Matriarch roles
        matriarch.grantRole(matriarch.UNDERWRITER_ROLE(), UNDERWRITER);
        matriarch.grantRole(matriarch.UNDERWRITER_ROLE(), address(this));

        // HRVST / VaultQuant / Kiiantu / Anima roles
        vaultQuant.grantRole(vaultQuant.TRUSTEE_ROLE(), TRUSTEE);
        vaultQuant.grantRole(vaultQuant.CPA_ROLE(), CPA);
        vaultQuant.grantRole(vaultQuant.ATTESTOR_ROLE(), ATTESTOR);
        vaultQuant.grantRole(vaultQuant.TRUSTEE_ROLE(), address(this));
        vaultQuant.grantRole(vaultQuant.CPA_ROLE(), address(this));
        hrvs.grantRole(hrvs.TRUSTEE_ROLE(), TRUSTEE);
        hrvs.grantRole(hrvs.CPA_ROLE(), CPA);
        hrvs.grantRole(hrvs.TRUSTEE_ROLE(), address(this));
        anima.grantRole(anima.GOVERNANCE_ROLE(), GOVERNANCE);
        anima.grantRole(anima.TRUSTEE_ROLE(), TRUSTEE);
        anima.grantRole(anima.GOVERNANCE_ROLE(), address(this));
        anima.grantRole(anima.TRUSTEE_ROLE(), address(this));
        kianitu.grantRole(kianitu.TRUSTEE_ROLE(), TRUSTEE);
        kianitu.grantRole(kianitu.TRUSTEE_ROLE(), address(this));
    }

    function _prepareCustodyAndAffidavit(bytes memory affidavitMeta) internal {
        safeVault.setCustody(ASSET_ID, true);
        safeVault.setDoc(ASSET_ID, keccak256("APPRAISAL"));
        affidavitRegistry.createAffidavit(ASSET_ID, affidavitMeta);
    }

    function testIssuanceGateRequiresCustodyAffidavitAndAnima() public {
        vaultQuant.setAssetNAV(ASSET_ID, 875_000 ether);

        // No custody yet.
        VM.expectRevert("CUSTODY_REQUIRED");
        vaultQuant.issueCSDN(ASSET_ID, 875_000 ether);

        _prepareCustodyAndAffidavit(
            abi.encode(
                "HASKINS",
                "UHMI 508(c)(1)(a); Cheroenhaka 1713",
                block.timestamp
            )
        );

        // Blocked by Anima override.
        anima.setActionOverride(ASSET_ID, ACTION_ISSUANCE, false);

        VM.expectRevert("ANIMA_BLOCKED");
        vaultQuant.issueCSDN(ASSET_ID, 875_000 ether);

        anima.setActionOverride(ASSET_ID, ACTION_ISSUANCE, true);

        uint256 noteId = vaultQuant.issueCSDN(ASSET_ID, 875_000 ether);
        VaultQuant.Note memory note = vaultQuant.getNote(noteId);
        assertEq(uint256(note.instrumentType), uint256(VaultQuant.InstrumentType.CSDN), "instrument mismatch");
        assertEq(note.par, 875_000 ether, "par mismatch");
    }

    function testPolicyFloorEnforcedOnMint() public {
        uint256 navCsdn = 400_000 ether;
        uint256 navSdn = 100_000 ether;
        uint256 expectedMintable = (navCsdn + navSdn) * hrvs.policyFloorBps() / 10_000;

        assertTrue(hrvs.hasRole(hrvs.TRUSTEE_ROLE(), address(this)), "test contract lacks trustee role");

        uint256 minted = hrvs.mintByNAV(navCsdn, navSdn, hrvs.policyFloorBps(), address(this));
        assertEq(minted, expectedMintable, "mint amount mismatch");

        (bool success, bytes memory returndata) = address(hrvs).call(
            abi.encodeWithSelector(
                hrvs.mintByNAV.selector,
                navCsdn,
                navSdn,
                hrvs.policyFloorBps(),
                address(this)
            )
        );
        assertTrue(!success, "Policy floor not enforced");
        bytes32 expectedHash = keccak256(abi.encodeWithSignature("Error(string)", "Policy floor"));
        assertEq(keccak256(returndata), expectedHash, "Unexpected revert reason");
    }

    function testInsuranceBandRejectsOutOfRangeFactor() public {
        VM.expectRevert("BAND_OUT_OF_RANGE");
        matriarch.bindCoverage(
            ASSET_ID,
            uint16(uint256(MatriarchInsurance.CoverageClass.REAL_ESTATE)),
            15000,
            keccak256("DISCLOSURE")
        );

        bytes32 binderId = matriarch.bindCoverage(
            ASSET_ID,
            uint16(uint256(MatriarchInsurance.CoverageClass.REAL_ESTATE)),
            50000,
            keccak256("DISCLOSURE")
        );
        assertTrue(binderId != bytes32(0), "binderId unset");
    }

    function testAttestationRecordsJurisdiction() public {
        bytes32 attestationId = eklesia.recordAttestation(
            ASSET_ID,
            keccak256("payload"),
            "ISSUANCE"
        );
        EklesiaAttestor.Attestation memory att = eklesia.get(attestationId);
        assertEq(att.subjectId, ASSET_ID, "subject mismatch");
        assertTrue(att.timestamp != 0, "timestamp missing");
    }

    function testRedemptionAdjustsNavAndSupply() public {
        _prepareCustodyAndAffidavit(abi.encode("demo"));
        vaultQuant.setAssetNAV(ASSET_ID, 500_000 ether);

        uint256 noteId = vaultQuant.issueCSDN(ASSET_ID, 500_000 ether);

        hrvs.mintByNAV(500_000 ether, 0, hrvs.policyFloorBps(), address(this));

        hrvs.burnFrom(address(this), 100_000 ether);

        vaultQuant.settleRedemption(noteId, 100_000 ether);

        VaultQuant.Note memory note = vaultQuant.getNote(noteId);
        assertEq(note.nav, 400_000 ether, "nav not reduced");

        (uint256 navCsdn, ) = vaultQuant.getAggregateNAV();
        assertEq(navCsdn, 400_000 ether, "aggregate nav mismatch");
    }
}
