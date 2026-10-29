import { z } from "zod";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export const nightlySnapshotRequest = z.object({
  snapshot_date: z.string().regex(isoDate),
  matters: z.array(
    z.object({
      matter_id: z.string().min(1),
      client_name: z.string().min(1),
      intake: z.object({
        received_on: z.string().regex(isoDate),
        summary: z.string().min(1),
      }),
      documents: z.array(
        z.object({
          document_id: z.string().min(1),
          title: z.string().min(1),
          status: z.enum(["draft", "sent", "signed"]),
          signed_on: z.string().regex(isoDate).optional(),
        }),
      ),
      deadlines: z.array(
        z.object({
          deadline_id: z.string().min(1),
          label: z.string().min(1),
          due_on: z.string().regex(isoDate),
          completed: z.boolean(),
        }),
      ),
    }),
  ).min(1),
});

export type NightlySnapshotRequest = z.infer<typeof nightlySnapshotRequest>;

export type MatterSnapshot = {
  snapshot_date: string;
  matter_id: string;
  client_name: string;
  intake: NightlySnapshotRequest["matters"][number]["intake"];
  signed_documents: Array<{
    document_id: string;
    title: string;
    signed_on: string;
  }>;
  open_deadlines: Array<{
    deadline_id: string;
    label: string;
    due_on: string;
    follow_up: "overdue" | "due_within_7_days" | "scheduled";
  }>;
};

function dayDistance(from: string, to: string): number {
  const milliseconds = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(milliseconds / 86_400_000);
}

export function buildMatterSnapshots(input: NightlySnapshotRequest): MatterSnapshot[] {
  return input.matters.map((matter) => ({
    snapshot_date: input.snapshot_date,
    matter_id: matter.matter_id,
    client_name: matter.client_name,
    intake: matter.intake,
    signed_documents: matter.documents.flatMap((document) =>
      document.status === "signed" && document.signed_on
        ? [{ document_id: document.document_id, title: document.title, signed_on: document.signed_on }]
        : [],
    ),
    open_deadlines: matter.deadlines
      .filter((deadline) => !deadline.completed)
      .map((deadline) => {
        const days = dayDistance(input.snapshot_date, deadline.due_on);
        const follow_up: MatterSnapshot["open_deadlines"][number]["follow_up"] =
          days < 0 ? "overdue" : days <= 7 ? "due_within_7_days" : "scheduled";
        return { ...deadline, completed: undefined, follow_up };
      })
      .map(({ deadline_id, label, due_on, follow_up }) => ({ deadline_id, label, due_on, follow_up })),
  }));
}

export function snapshotObjectKey(snapshot: MatterSnapshot): string {
  return `legal-snapshots/${snapshot.snapshot_date}/${snapshot.matter_id}.json`;
}
