import assert from "node:assert/strict";
import test from "node:test";
import { buildMatterSnapshots, nightlySnapshotRequest } from "../src/matter_snapshot.js";

test("the nightly snapshot keeps signed deliveries and labels open deadline follow-up", () => {
  const input = nightlySnapshotRequest.parse({
    snapshot_date: "2026-09-22",
    matters: [
      {
        matter_id: "MAT-9",
        client_name: "Aperture Editions",
        intake: { received_on: "2026-09-01", summary: "Rights clearance" },
        documents: [
          { document_id: "SIGNED", title: "Release", status: "signed", signed_on: "2026-09-20" },
          { document_id: "DRAFT", title: "Schedule", status: "draft" },
        ],
        deadlines: [
          { deadline_id: "LATE", label: "Send release", due_on: "2026-09-21", completed: false },
          { deadline_id: "SOON", label: "File notice", due_on: "2026-09-27", completed: false },
          { deadline_id: "DONE", label: "Open matter", due_on: "2026-09-10", completed: true },
        ],
      },
    ],
  });

  const [snapshot] = buildMatterSnapshots(input);
  assert.deepEqual(snapshot.signed_documents.map((item) => item.document_id), ["SIGNED"]);
  assert.deepEqual(
    snapshot.open_deadlines.map((item) => [item.deadline_id, item.follow_up]),
    [["LATE", "overdue"], ["SOON", "due_within_7_days"]],
  );
});
