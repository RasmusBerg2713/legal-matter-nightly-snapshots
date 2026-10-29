import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { ensureSnapshotBucket, InfraiError, infrai } from "./infrai_storage.js";
import {
  buildMatterSnapshots,
  nightlySnapshotRequest,
  snapshotObjectKey,
} from "./matter_snapshot.js";

const bucket = process.env.SNAPSHOT_BUCKET ?? "legal-matter-nightly-snapshots";
const port = Number(process.env.PORT ?? 3000);

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const bucketReady = ensureSnapshotBucket(bucket);

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/nightly-snapshots") {
    json(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = nightlySnapshotRequest.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const snapshots = buildMatterSnapshots(input);

    await bucketReady;
    const stored = await Promise.all(
      snapshots.map(async (snapshot) => {
        const key = snapshotObjectKey(snapshot);
        const bytes = Buffer.from(JSON.stringify(snapshot, null, 2));
        await infrai.storage.object.put(bucket, key, bytes.toString("base64"));
        return { matter_id: snapshot.matter_id, key, bytes: bytes.byteLength };
      }),
    );

    json(response, 201, { bucket, snapshot_date: input.snapshot_date, stored });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "Invalid snapshot request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.message });
      return;
    }
    console.error(error);
    json(response, 500, { error: "Snapshot could not be stored" });
  }
});

if (process.env.NODE_ENV !== "test") {
  server.listen(port, () => {
    console.log(`Nightly snapshot service listening on http://localhost:${port}`);
  });
}
