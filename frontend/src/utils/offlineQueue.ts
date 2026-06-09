import { storage } from "@/src/utils/storage";
import { apiFetchWithAuth } from "@/src/utils/api";

const QUEUE_KEY = "boncos_offline_mutation_queue";

type OfflineExpense = {
  id: string;
  type: "expense";
  payload: {
    amount: number;
    note: string;
    budget_id: string;
    expense_date: string;
  };
  created_at: string;
};

type OfflineCheckIn = {
  id: string;
  type: "check-in";
  payload: {
    checkin_date: string;
    note?: string;
  };
  created_at: string;
};

export type OfflineMutation = OfflineExpense | OfflineCheckIn;

function makeId() {
  return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readQueue(): Promise<OfflineMutation[]> {
  const raw = await storage.getItem(QUEUE_KEY, "[]");
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: OfflineMutation[]) {
  await storage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getPendingMutationCount() {
  return (await readQueue()).length;
}

export async function queueExpense(payload: OfflineExpense["payload"]) {
  const queue = await readQueue();
  queue.push({ id: makeId(), type: "expense", payload, created_at: new Date().toISOString() });
  await writeQueue(queue);
  return queue.length;
}

export async function queueCheckIn(payload: OfflineCheckIn["payload"]) {
  const queue = await readQueue();
  queue.push({ id: makeId(), type: "check-in", payload, created_at: new Date().toISOString() });
  await writeQueue(queue);
  return queue.length;
}

export async function syncPendingMutations() {
  const queue = await readQueue();
  if (queue.length === 0) return { synced: 0, pending: 0 };

  const pending: OfflineMutation[] = [];
  let synced = 0;

  for (const item of queue) {
    const path = item.type === "expense" ? "/expenses" : "/check-in";
    const result = await apiFetchWithAuth(path, {
      method: "POST",
      body: item.payload,
    });

    if ((result as any)?.error) {
      pending.push(item);
      continue;
    }

    synced += 1;
  }

  await writeQueue(pending);
  return { synced, pending: pending.length };
}
