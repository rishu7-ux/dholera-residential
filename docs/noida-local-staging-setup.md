# Noida CRM localhost staging setup

This launcher is for this release worktree on the local Mac only. It binds Next to `127.0.0.1:3101` and validates the Atlas TEST Cluster0 target before starting Next or Payload. Do not use `npm run dev` or `npm run dev:test` for this staging database.

## Required server environment

Inject these variables through an approved local secret manager or private shell session. The placeholders below are **not** usable credentials; do not put real values in source control or command history. The launcher rejects Next `.env` files so it can validate the same environment that Next receives.

```text
NOIDA_LOCAL_STAGING_MODE=1
MONGODB_URI=mongodb+srv://noida_stage_app:<URL_ENCODED_STAGE_PASSWORD>@cluster0.zshxfui.mongodb.net/omana-phase5-crm-stage-20261017a?authSource=admin&retryWrites=true&w=majority&tls=true
PAYLOAD_SECRET=<UNIQUE_LOCAL_STAGING_SECRET_AT_LEAST_32_CHARACTERS>
NOIDA_SMTP_DELIVERY_ENABLED=0
```

`NOIDA_LOCAL_STAGING_BIND` and `NODE_ENV=development` are set by the launcher. Do not set Vercel variables, `NOIDA_STAGING_MODE`, `NOIDA_STAGING_PROJECT_ID`, `MONGODB_TEST_URI`, `PAYLOAD_DROP_DATABASE`, Blob/RAG/SMTP credentials or website ingest secrets. The launcher rejects conflicting settings. Never use production credentials or the existing `omana-phase5-test-2` database.

After independent Atlas isolation review and separate approval for the dedicated database/user and startup writes, provision `noida_stage_app` with `readWrite` on **only** `omana-phase5-crm-stage-20261017a` in TEST Cluster0. Keep the local Mac IP narrowly allowlisted. Confirm the database target and user role through authorized read-only review before starting. The database and indexes are not initialized by this guide; that first write needs its own approval. Local mode disables automatic Mongoose index creation, and it refuses `PAYLOAD_DROP_DATABASE`.

## Start and verify after approval

```bash
npm run dev:local-staging
curl -I --max-time 5 http://127.0.0.1:3101/admin
```

The HTTP check only confirms local reachability. It does not prove Atlas isolation, database initialization or CRM behavior. Stop if the launcher rejects the environment; do not bypass it with a direct Next command.
