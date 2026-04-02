import { createAdminClient } from "@/lib/supabase/admin";
import type { Notification, NotificationType, AttentionLevel } from "@/types/domain";

function toNotification(row: Record<string, unknown>): Notification {
  const campaign = row.campaigns as Record<string, unknown> | null;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    campaignId: (row.campaign_id as string) || null,
    type: row.type as NotificationType,
    level: row.level as AttentionLevel,
    title: row.title as string,
    body: (row.body as string) || "",
    read: Boolean(row.read),
    readAt: (row.read_at as string) || null,
    createdAt: row.created_at as string,
    campaign: campaign
      ? {
          id: campaign.id as string,
          wfNumber: campaign.wf_number as string,
          name: campaign.name as string,
        }
      : undefined,
  };
}

export async function listNotifications(userId: string): Promise<Notification[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*, campaigns(id, wf_number, name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []).map((row) => toNotification(row as Record<string, unknown>));
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) throw error;
}

// --- Notification creation helpers ---

export async function createNotification(params: {
  userId: string;
  type: string;
  level?: string;
  title: string;
  body?: string;
  campaignId?: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    type: params.type,
    level: params.level || "info",
    title: params.title,
    body: params.body || "",
    campaign_id: params.campaignId || null,
  });
  if (error) throw error;
}

export async function notifyGoalStakeholders(
  goalId: string,
  excludeUserId: string,
  notification: { type: string; level?: string; title: string; body?: string }
): Promise<void> {
  const supabase = createAdminClient();
  const { data: stakeholders } = await supabase
    .from("goal_stakeholders")
    .select("user_id")
    .eq("goal_id", goalId);

  if (!stakeholders?.length) return;

  const inserts = stakeholders
    .filter((s) => s.user_id !== excludeUserId)
    .map((s) => ({
      user_id: s.user_id,
      type: notification.type,
      level: notification.level || "info",
      title: notification.title,
      body: notification.body || "",
    }));

  if (inserts.length > 0) {
    const { error } = await supabase.from("notifications").insert(inserts);
    if (error) throw error;
  }
}
