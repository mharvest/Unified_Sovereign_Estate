# SafeVault Upload Runbook

The SafeVault upload endpoint stores custody documents on disk, records the SHA-256 in Postgres (`CustodyDoc`), and optionally notifies fiduciaries via SMTP. In demo mode the stack ships with MailHog listening on `mailhog:1025` (web UI at [http://localhost:8025](http://localhost:8025)).

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `SAFEVAULT_UPLOADS_ENABLED` | Enables the `/vault/upload` route. Defaults to `false`. |
| `SAFEVAULT_STORAGE_PATH` | Local path (inside the container) where uploaded files are stored. |
| `SAFEVAULT_SMTP_HOST` / `SAFEVAULT_SMTP_PORT` | SMTP endpoint for notifications (defaults to `mailhog:1025`). |
| `SAFEVAULT_NOTIFICATION_TO` | Comma-separated list of email recipients notified on upload. |

## API

`POST /vault/upload` (roles: `LAW`, `OPS`)

```json
{
  "assetId": "HASKINS-16315",
  "fileName": "affidavit.pdf",
  "content": "<base64-encoded bytes>",
  "notify": true
}
```

Responses:

- `201`: `{ "sha256": "0x…", "assetId": "0x…", "txHash": "0x…" }`
- `502`: notification failed (`MailHog` unavailable or SMTP error)
- `503`: uploads disabled (`SAFEVAULT_UPLOADS_ENABLED=false`)

On success the service:

1. Writes the file under `SAFEVAULT_STORAGE_PATH/<assetId>/<timestamp>_<fileName>`
2. Persists/updates the `CustodyDoc` record keyed by SHA-256
3. Calls `contracts.setDoc` when the contract gateway is configured
4. Logs an audit entry with action `SAFEVAULT_UPLOAD`
5. Sends an email notification when SMTP settings are supplied

## Demo

```bash
make safevault-demo        # Uploads a demo document and triggers MailHog notification
```

This target expects:
- `SAFEVAULT_UPLOADS_ENABLED=true` inside the `se7en` container.
- `SE7EN_DEMO_JWT` populated with a LAW or OPS token (see the signing docs for instructions).

After running the command, open [http://localhost:8025](http://localhost:8025) to view the captured email in MailHog.
```

JWT requirements mirror the other fiduciary routes (LAW/OPS token needed for upload).
