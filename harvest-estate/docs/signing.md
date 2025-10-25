# DocuSign Signing Module

Se7en exposes a lightweight DocuSign integration layer to issue envelopes and ingest Connect webhooks. The default provider is an in-memory stub suitable for demos; set `SIGN_PROVIDER=DOCUSIGN` when wiring to a live account.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `SIGN_ENABLED` | Enables the signing routes when set to `true`. |
| `SIGN_PROVIDER` | Signing backend (`STUB` by default, `DOCUSIGN` reserved for future expansion). |
| `DOCUSIGN_WEBHOOK_PUBLIC_KEY` | Base64/PEM-encoded RSA public key used to verify Connect webhook signatures. Optional; when omitted, signatures are accepted in stub mode. |

The automation loop (`make sign-demo`) sets `SIGN_ENABLED=true` automatically.

## API Routes

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| `POST` | `/sign/envelope` | LAW, OPS | Creates a DocuSign envelope and records a `SignatureEnvelope` entry. |
| `POST` | `/sign/webhook` | n/a | Receives DocuSign Connect callbacks, updates envelope status, and stores `SignatureEvent` records. |

### Envelope Request Example

```json
{
  "assetId": "HASKINS-16315",
  "type": "STANDARD",
  "recipients": [
    { "name": "Althea Chambers", "email": "law@harvest.estate", "role": "SIGNER" }
  ],
  "documents": [
    { "name": "Affidavit", "sha256": "0x9f3c..." }
  ]
}
```

### Webhook Payload Example

```json
{
  "envelopeId": "env_123",
  "status": "COMPLETED",
  "signerEmail": "law@harvest.estate",
  "signedAt": "2025-10-21T21:10:00.000Z",
  "event": {
    "eventId": "evt_456",
    "type": "completed",
    "occurredAt": "2025-10-21T21:10:03.000Z"
  }
}
```

If `DOCUSIGN_WEBHOOK_PUBLIC_KEY` is provided, the service verifies the `x-docusign-signature-1` header using RSA-SHA256. In stub mode the signature check is bypassed.

## Demo Workflow

- Generate a JWT for a LAW/OPS user (`npm run jwt:create LAW`).
- Enable signing (`SIGN_ENABLED=true`) and run `make sign-demo` or call `/sign/envelope` directly.
- Webhook events populate `SignatureEnvelope` and `SignatureEvent` tables for downstream audit trails.
- MailHog captures demo traffic at [http://localhost:8025](http://localhost:8025).
