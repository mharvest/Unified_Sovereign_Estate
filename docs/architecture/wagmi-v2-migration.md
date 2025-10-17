# Wagmi v2 Migration Notes

Goal: eliminate the WalletConnect v1 dependency chain (`fast-redact`, `ws@8.x`) by upgrading the console to wagmi/AppKit v2.

## Target Stack
- `wagmi@2.x`
- `@reown/appkit` (WalletConnect v2 successor)
- `viem@^2.16`

## Work Plan
1. **ConfigLayer**: replace `frontend/lib/wagmiClient.ts` with the new `createConfig` API, using `appkit` connectors. Provide feature flag (`NEXT_PUBLIC_WAGMI_V2=1`) for gradual rollout.
2. **Hook Renames**:
   - `useContractWrite` → `useWriteContract`
   - `useContractReads` → `useReadContracts`
   - `useContractEvent` → `useWatchContractEvent`
   - Update error typings (new `BaseError` results) and signature of callbacks.
3. **Connector Setup**: create `frontend/lib/wallet/connectors.ts` that exports reusable connectors for both wagmi v1 and v2 to simplify toggling.
4. **Transaction Helpers**: abstract the tx-hash extraction logic into `frontend/lib/tx.ts` to align with the `Hash` type returned by wagmi v2.
5. **UI Layer**: integrate AppKit modal (replaces wagmi’s `WalletConnectConnector`) and add `AppKitProvider` around `_app.tsx`.
6. **Testing**: update Playwright helpers to stub the new modal window and ensure `Simulator Mode` continues to work when no wallet is connected.
7. **Docs**: once merged, remove `docs/security/wagmi.md` advisory and reference the new `frontend/lib/wagmiClientV2.ts` implementation.

## Branch Checklist
- [ ] Add v2 config behind feature flag
- [ ] Run `npm audit` to verify advisories resolved
- [ ] Update CI to run e2e suite with v2 flag enabled
- [ ] Document manual QA (connect wallet via AppKit, originate note, redeem)
