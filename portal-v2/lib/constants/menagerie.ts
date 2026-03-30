// ============================================================
// Mutant Menagerie — creature registry & trigger words
// ============================================================

export type CreatureKey = "gator" | "peacock" | "moth" | "raccoon";

export interface Creature {
  key: CreatureKey;
  name: string;
  description: string;
  triggerHint: string;
}

export const CREATURES: Creature[] = [
  {
    key: "gator",
    name: "Mutant Gator",
    description: "Scrappy, chompy, and low to the ground.",
    triggerHint: "Lurks in the shadows of the sidebar.",
  },
  {
    key: "peacock",
    name: "Pretentious Peacock",
    description: "Dramatic. Strutting. Fully fanned.",
    triggerHint: "Drawn to pretentious language.",
  },
  {
    key: "moth",
    name: "Studio Moth",
    description: "Fuzzy wings, big antenna, obsessed with light.",
    triggerHint: "Can't resist anything that glows.",
  },
  {
    key: "raccoon",
    name: "Crafty Raccoon",
    description: "Masked bandit. Always snacking.",
    triggerHint: "Follows the smell of food.",
  },
];

// Peacock: pretentious / corporate BS words
export const PEACOCK_TRIGGER_WORDS = [
  "elevated",
  "curated",
  "bespoke",
  "premium",
  "artisanal",
  "synergy",
  "ideate",
  "leverage",
  "holistic",
  "paradigm",
  "align",
  "circle back",
  "bandwidth",
  "stakeholder",
  "optimize",
  "thought leader",
  "disrupt",
  "pivot",
];

// Moth: light, lighting, and lighting gear
export const MOTH_TRIGGER_WORDS = [
  "light",
  "lighting",
  "softbox",
  "key light",
  "fill light",
  "backlight",
  "c-stand",
  "scrim",
  "diffusion",
  "gel",
  "led panel",
  "strobe",
  "reflector",
  "kino",
  "fresnel",
  "gobo",
];

// Raccoon: food and craft services
export const RACCOON_TRIGGER_WORDS = [
  "lunch",
  "breakfast",
  "craft services",
  "crafty",
  "catering",
  "meal",
  "snack",
  "food",
  "coffee",
  "dinner",
  "wrap lunch",
];
