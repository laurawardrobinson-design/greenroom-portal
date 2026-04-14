// Edit room colors — one per room slot, consistent by sort_order index
export const EDIT_ROOM_COLORS: Array<{
  bg: string;
  text: string;
  border: string;
  light: string;
}> = [
  { bg: "bg-violet-500",  text: "text-white",        border: "border-violet-600",  light: "bg-violet-50 text-violet-700 border-violet-200" },
  { bg: "bg-sky-500",     text: "text-white",        border: "border-sky-600",     light: "bg-sky-50 text-sky-700 border-sky-200" },
  { bg: "bg-emerald-500", text: "text-white",        border: "border-emerald-600", light: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { bg: "bg-amber-500",   text: "text-white",        border: "border-amber-600",   light: "bg-amber-50 text-amber-700 border-amber-200" },
  { bg: "bg-rose-500",    text: "text-white",        border: "border-rose-600",    light: "bg-rose-50 text-rose-700 border-rose-200" },
  { bg: "bg-teal-500",    text: "text-white",        border: "border-teal-600",    light: "bg-teal-50 text-teal-700 border-teal-200" },
];

export function getRoomColor(index: number) {
  return EDIT_ROOM_COLORS[index % EDIT_ROOM_COLORS.length];
}

export const DRIVE_SIZES = ["500 GB", "1 TB", "2 TB", "4 TB", "8 TB", "12 TB", "16 TB"];
export const DRIVE_TYPES = ["HDD", "HDD - Superspeed", "Portable SSD"];
export const DRIVE_CONDITIONS = ["Good", "Fair", "Poor", "Damaged"] as const;
export const DRIVE_STATUSES = ["Available", "Reserved", "Checked Out", "Pending Backup/Wipe", "Retired"] as const;
export const DRIVE_LOCATIONS = ["Corporate", "With Editor", "On Set", "Other"] as const;
export const BACKUP_LOCATIONS = ["ShareBrowser", "NAS", "LTO Tape", "Cloud", "Other"];
