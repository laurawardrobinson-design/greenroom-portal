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

// Notify all producers assigned to a campaign (via campaign_producers + fallback producer_id)
export async function notifyCampaignProducers(
  campaignVendorId: string,
  notification: { type: string; level?: string; title: string; body?: string }
): Promise<void> {
  const supabase = createAdminClient();

  // Get campaign info + vendor name via campaign_vendors
  const { data: cv } = await supabase
    .from("campaign_vendors")
    .select("campaign_id, vendors(company_name), campaigns(id, name, wf_number, producer_id)")
    .eq("id", campaignVendorId)
    .single();

  if (!cv) return;
  const campaignId = cv.campaign_id;
  const campaign = (Array.isArray(cv.campaigns) ? cv.campaigns[0] : cv.campaigns) as { id: string; name: string; wf_number: string; producer_id: string | null } | null;

  // Gather producer user IDs
  const producerIds = new Set<string>();
  const { data: assigned } = await supabase
    .from("campaign_producers")
    .select("user_id")
    .eq("campaign_id", campaignId);
  (assigned || []).forEach((r: { user_id: string }) => producerIds.add(r.user_id));
  if (campaign?.producer_id) producerIds.add(campaign.producer_id);

  if (producerIds.size === 0) return;

  const inserts = [...producerIds].map((userId) => ({
    user_id: userId,
    type: notification.type,
    level: notification.level || "info",
    title: notification.title,
    body: notification.body || "",
    campaign_id: campaignId,
  }));

  const { error } = await supabase.from("notifications").insert(inserts);
  if (error) throw error;
}

// Notify all Admin users (HOP)
export async function notifyAdmins(notification: {
  type: string;
  level?: string;
  title: string;
  body?: string;
  campaignId?: string;
}): Promise<void> {
  const supabase = createAdminClient();

  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .eq("role", "Admin")
    .eq("active", true);

  if (!admins?.length) return;

  const inserts = admins.map((u: { id: string }) => ({
    user_id: u.id,
    type: notification.type,
    level: notification.level || "info",
    title: notification.title,
    body: notification.body || "",
    campaign_id: notification.campaignId || null,
  }));

  const { error } = await supabase.from("notifications").insert(inserts);
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
