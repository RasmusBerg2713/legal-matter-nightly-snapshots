const endpoint = process.env.SNAPSHOT_ENDPOINT ?? "http://localhost:3000/nightly-snapshots";

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    snapshot_date: "2026-09-22",
    matters: [
      {
        matter_id: "MAT-1042",
        client_name: "Northwind Publishing",
        intake: {
          received_on: "2026-09-10",
          summary: "Review licensing terms for a documentary archive.",
        },
        documents: [
          {
            document_id: "DOC-7",
            title: "Archive license agreement",
            status: "signed",
            signed_on: "2026-09-21",
          },
          { document_id: "DOC-8", title: "Exhibit index", status: "draft" },
        ],
        deadlines: [
          {
            deadline_id: "DL-3",
            label: "Deliver countersigned agreement",
            due_on: "2026-09-25",
            completed: false,
          },
        ],
      },
    ],
  }),
});

const result: unknown = await response.json();
if (!response.ok) throw new Error(`Snapshot request returned HTTP ${response.status}`);
console.log(JSON.stringify(result, null, 2));
