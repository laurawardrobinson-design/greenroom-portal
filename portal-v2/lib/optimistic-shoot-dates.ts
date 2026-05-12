// Bridges optimistic temp shoot-date ids (used while the create POST is
// in flight) with the real server-assigned ids. The calendar tile registers
// a promise when it inserts a temp date; the shoot-day list awaits it
// before issuing edits (e.g. call time) so saves aren't dropped on temp ids.

const pending = new Map<string, Promise<string>>();

export function registerPendingShootDateId(tempId: string, real: Promise<string>) {
  pending.set(tempId, real);
  real.finally(() => {
    // Hold the entry briefly so late awaits still resolve, then clear.
    setTimeout(() => pending.delete(tempId), 5000);
  });
}

export async function resolveShootDateId(id: string): Promise<string> {
  if (!id.startsWith("tmp-")) return id;
  const p = pending.get(id);
  if (!p) throw new Error("Unknown temporary shoot-date id");
  return p;
}

export function isTempShootDateId(id: string): boolean {
  return id.startsWith("tmp-");
}
