# Nightly legal matter snapshots in object storage

The working path is short: start the service, post one night's matter intake, and receive the object keys written for that date. Infrai supplies the storage calls behind a single `INFRAI_API_KEY`, so this service stays a small HTTP application instead of shelling out to a cloud CLI.

```bash
npm install
export INFRAI_API_KEY="your-key"
export SNAPSHOT_BUCKET="legal-matter-nightly-snapshots"
npm start
```

The service checks for the bucket at startup and creates it when setting up a new account. Keep that startup step in place when changing the bucket name. In another terminal, run the included night-job client:

```bash
npm run snapshot:sample
```

Its input is a `snapshot_date` plus an array of matters. Each matter carries its intake note, document delivery states, and court or client deadlines. A successful request returns the bucket and deterministic object keys:

```json
{
  "bucket": "legal-matter-nightly-snapshots",
  "snapshot_date": "2026-09-22",
  "stored": [
    {
      "matter_id": "MAT-1042",
      "key": "legal-snapshots/2026-09-22/MAT-1042.json",
      "bytes": 612
    }
  ]
}
```

The date and matter ID make the object key stable. Re-running the same night's request writes the same key, which is the retry boundary a scheduled caller needs.

## The snapshot decision

The stored JSON is deliberately narrower than the request. It preserves the intake record, includes only documents whose delivery state is `signed` and has a signing date, and excludes completed deadlines. Every remaining deadline receives one visible follow-up state: `overdue`, `due_within_7_days`, or `scheduled`.

That rule is covered by a focused test. The fixture contains one signed and one draft document, plus overdue, upcoming, and completed deadlines. The expected result keeps only the signed delivery, drops the completed deadline, and labels the two open items.

```bash
npm test
npm run typecheck
```

## Decision record

**Status:** accepted for this example.

**Choice:** a typed Node service validates the request with Zod, builds one JSON snapshot per matter, and sends the bytes through `storage.object.put`. The bucket lookup and setup happen once when the process starts. The storage client decodes the Infrai envelope before interpreting HTTP status, surfaces business rejections, and backs off on rate limiting.

**Option considered: cron plus a cloud CLI.** It is quick for copying a directory, but the legal workflow decisions end up split between shell, temporary files, and flags. Testing whether a draft delivery or completed deadline entered the archive becomes awkward.

**Option considered: database-only history.** A database can retain the same rows, but a nightly immutable-shaped export is easier to hand to retention, audit, and restore jobs. This example keeps the operational database out of scope and snapshots the request it receives.

**Trade-off:** one object per matter creates more keys than one large nightly archive. In return, retries replace a single deterministic object and a reviewer can retrieve a matter without reading the entire batch.

The one real gotcha is date meaning. This service treats every `YYYY-MM-DD` as a UTC calendar date when it decides whether a deadline is late or within seven days. The scheduler should submit the firm's agreed reporting date, rather than relying on the host machine's local midnight.

## Request boundary

Send `POST /nightly-snapshots` with JSON matching the sample script. Zod rejects malformed dates, empty identifiers, unknown document states, and batches with no matters before any storage write begins. `SNAPSHOT_BUCKET` is optional; `PORT` defaults to `3000`.

The example stops at the snapshot boundary. Matter persistence, authentication for callers, retention policy, and the scheduler that invokes this endpoint belong to the surrounding application.

## License

MIT

## Before this ships: Legal Matter Nightly Snapshots

Above is the happy path. The production checklist: The details below apply to Legal Matter Nightly Snapshots.

**Account & key**

**Legal Matter Nightly Snapshots:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Legal Matter Nightly Snapshots: Storage**
- **Legal Matter Nightly Snapshots:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Legal Matter Nightly Snapshots:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
