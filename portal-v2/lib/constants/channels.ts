// Channel deliverable presets with standard crop ratios
export interface ChannelPreset {
  channel: string;
  format: string;
  width: number;
  height: number;
  aspectRatio: string;
}

export const CHANNEL_PRESETS: ChannelPreset[] = [
  // Instagram
  { channel: "Instagram", format: "Feed Post (Square)", width: 1080, height: 1080, aspectRatio: "1:1" },
  { channel: "Instagram", format: "Feed Post (Portrait)", width: 1080, height: 1350, aspectRatio: "4:5" },
  { channel: "Instagram", format: "Feed Post (Landscape)", width: 1080, height: 566, aspectRatio: "1.91:1" },
  { channel: "Instagram", format: "Story / Reel", width: 1080, height: 1920, aspectRatio: "9:16" },
  { channel: "Instagram", format: "Carousel", width: 1080, height: 1080, aspectRatio: "1:1" },

  // TikTok
  { channel: "TikTok", format: "Video", width: 1080, height: 1920, aspectRatio: "9:16" },

  // YouTube
  { channel: "YouTube", format: "Thumbnail", width: 1280, height: 720, aspectRatio: "16:9" },
  { channel: "YouTube", format: "Short", width: 1080, height: 1920, aspectRatio: "9:16" },

  // Facebook
  { channel: "Facebook", format: "Feed Post", width: 1200, height: 630, aspectRatio: "1.91:1" },
  { channel: "Facebook", format: "Story", width: 1080, height: 1920, aspectRatio: "9:16" },

  // Pinterest
  { channel: "Pinterest", format: "Standard Pin", width: 1000, height: 1500, aspectRatio: "2:3" },

  // Web / Banner
  { channel: "Web", format: "Hero Banner", width: 1920, height: 1080, aspectRatio: "16:9" },
  { channel: "Web", format: "Product Card", width: 800, height: 800, aspectRatio: "1:1" },

  // Print
  { channel: "Print", format: "Full Page", width: 2550, height: 3300, aspectRatio: "8.5:11" },
  { channel: "Print", format: "Half Page", width: 2550, height: 1650, aspectRatio: "8.5:5.5" },

  // Email
  { channel: "Email", format: "Header", width: 600, height: 200, aspectRatio: "3:1" },
  { channel: "Email", format: "Hero Image", width: 600, height: 400, aspectRatio: "3:2" },
];

export const UNIQUE_CHANNELS = [...new Set(CHANNEL_PRESETS.map((p) => p.channel))];

// ─── Production portal channel templates (exact match) ─────────────────────

export interface ChannelTemplate {
  name: string;
  abbr: string;
  type: "social" | "video" | "photo";
  specs: string[];
}

export const CHANNEL_TEMPLATES: ChannelTemplate[] = [
  // Social
  { name: "Instagram Feed",      abbr: "IG Feed",     type: "social", specs: ["1:1", "4:5"] },
  { name: "Instagram Reels",     abbr: "IG Reels",    type: "social", specs: ["9:16"] },
  { name: "Instagram Stories",   abbr: "IG Stories",  type: "social", specs: ["9:16"] },
  { name: "TikTok",              abbr: "TikTok",      type: "social", specs: ["9:16"] },
  { name: "Facebook Feed",       abbr: "FB Feed",     type: "social", specs: ["1:1", "4:5", "16:9"] },
  { name: "FB/IG Stories (Ads)", abbr: "FB/IG Story", type: "social", specs: ["9:16"] },
  { name: "LinkedIn Feed",       abbr: "LinkedIn",    type: "social", specs: ["1:1", "16:9", "4:5"] },
  // Video
  { name: "YouTube Standard",    abbr: "YT Standard", type: "video",  specs: ["16:9"] },
  { name: "YouTube Shorts",      abbr: "YT Shorts",   type: "video",  specs: ["9:16"] },
  { name: "YouTube Pre-Roll",    abbr: "YT Pre-Roll", type: "video",  specs: ["16:9", "1:1"] },
  // Photo
  { name: "Website Hero",        abbr: "Web Hero",    type: "photo",  specs: ["16:9", "21:9"] },
  { name: "Website Content",     abbr: "Web Content", type: "photo",  specs: ["1:1", "4:3"] },
  { name: "Display Ads",         abbr: "Display",     type: "photo",  specs: ["1:1", "300×250", "728×90"] },
  { name: "Email Marketing",     abbr: "Email Mktg",  type: "photo",  specs: ["1:1", "16:9"] },
  { name: "E-commerce PDP",      abbr: "Ecomm PDP",   type: "photo",  specs: ["1:1", "4:5"] },
];

// Pixel dimensions for known spec strings
export const SPEC_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "1:1":     { width: 1080, height: 1080 },
  "4:5":     { width: 1080, height: 1350 },
  "9:16":    { width: 1080, height: 1920 },
  "16:9":    { width: 1920, height: 1080 },
  "4:3":     { width: 1080, height: 810 },
  "21:9":    { width: 2560, height: 1080 },
  "300×250": { width: 300,  height: 250 },
  "728×90":  { width: 728,  height: 90 },
};
