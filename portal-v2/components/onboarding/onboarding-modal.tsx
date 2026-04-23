"use client";

import { useRef, useState } from "react";
import type { AppUser } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useToast } from "@/components/ui/toast";
import {
  Mail,
  Phone,
  Check,
  ChevronRight,
  ChevronLeft,
  Utensils,
  Contact,
  X,
  AlertTriangle,
  MessageSquare,
  Zap,
} from "lucide-react";

// -------------------------------------------------------
// Publix product catalog — image icon + display name
// -------------------------------------------------------
export const PUBLIX_PRODUCTS: { name: string; icon: string }[] = [
  { name: "Pub Sub", icon: "/icons/products/pub-sub.svg" },
  { name: "Fried Chicken", icon: "/icons/products/fried-chicken.svg" },
  { name: "Chantilly Cake", icon: "/icons/products/chantilly-cake.svg" },
  { name: "Tea", icon: "/icons/products/sweet-tea.svg" },
  { name: "Key Lime Pie", icon: "/icons/products/key-lime-pie.svg" },
  { name: "Deli Potato Wedges", icon: "/icons/products/potato-wedges.svg" },
  { name: "Publix Ice Cream", icon: "/icons/products/ice-cream.svg" },
  { name: "Sushi", icon: "/icons/products/sushi.svg" },
  { name: "Cookies", icon: "/icons/products/sprinkle-cookie.svg" },
  { name: "Fresh Flowers", icon: "/icons/products/fresh-flowers.svg" },
  { name: "Premium Meat", icon: "/icons/products/premium-meat.svg" },
  { name: "Grab & Go Salad", icon: "/icons/products/salad.svg" },
];

export function getProductIcon(productName: string): string | null {
  const found = PUBLIX_PRODUCTS.find((p) => p.name === productName);
  return found?.icon ?? null;
}

// -------------------------------------------------------
// Preset options
// -------------------------------------------------------
export const SNACK_PRESETS = [
  "Fresh Fruit",
  "Trail Mix",
  "RX Bar",
  "Chef Patrick's Grilled Cheese",
  "PB Pretzels",
  "Yogurt",
  "M&Ms",
  "Bagel & Cream Cheese",
];

export const DRINK_PRESETS = [
  "Water",
  "Gatorade",
  "Coke Zero",
  "Diet Coke",
  "LaCroix",
  "Orange Juice",
  "Iced Tea",
  "Lemonade",
];

export const ENERGY_PRESETS = [
  "Iced Coffee",
  "Hot Coffee",
  "Cold Brew",
  "Red Bull",
  "Alani",
  "Espresso",
  "Matcha Latte",
];

// -------------------------------------------------------
// Dietary restriction options
// -------------------------------------------------------
const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Halal",
  "Kosher",
  "No Restrictions",
];

// -------------------------------------------------------
// Contact method options
// -------------------------------------------------------
export const CONTACT_OPTIONS = [
  { value: "Cell Phone", label: "Cell phone", icon: Phone, description: "Call or text" },
  { value: "Email", label: "Email", icon: Mail, description: "Best way to reach me" },
  { value: "Teams", label: "Teams", icon: MessageSquare, description: "I'm always on Teams" },
];

// -------------------------------------------------------
// Phone formatter — strips non-digits, outputs (###) ###-####
// -------------------------------------------------------
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// -------------------------------------------------------
// Tag input component (exported for settings page)
// -------------------------------------------------------
export function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(value: string) {
    const trimmed = value.trim().replace(/,+$/, "");
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input) {
      onChange(tags.slice(0, -1));
    }
  }

  function handleBlur() {
    if (input.trim()) addTag(input);
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 min-h-[42px] focus-within:border-primary cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary shrink-0"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(tags.filter((t) => t !== tag));
            }}
            className="text-primary/60 hover:text-primary leading-none"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
      />
    </div>
  );
}

// -------------------------------------------------------
// Preset chips — toggling for snacks/drinks
// -------------------------------------------------------
function PresetChips({
  presets,
  activeTags,
  onToggle,
}: {
  presets: string[];
  activeTags: string[];
  onToggle: (preset: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((preset) => {
        const active = activeTags.includes(preset);
        return (
          <button
            key={preset}
            type="button"
            onClick={() => onToggle(preset)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
              active
                ? "bg-primary text-white border-primary"
                : "bg-surface border-border text-text-secondary hover:border-primary/40 hover:text-text-primary"
            }`}
          >
            {preset}
          </button>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------
// Step progress bar
// -------------------------------------------------------
const STEP_COUNT = 4; // steps 1–4

function ProgressDots({ step }: { step: number }) {
  if (step === 0 || step === STEP_COUNT + 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: STEP_COUNT }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i + 1 <= step ? "w-6 bg-primary" : "w-1.5 bg-border"
          }`}
        />
      ))}
    </div>
  );
}

// -------------------------------------------------------
// Main component
// -------------------------------------------------------
interface OnboardingModalProps {
  user: AppUser;
  onComplete: () => void;
}

export function OnboardingModal({ user, onComplete }: OnboardingModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedProduct, setSelectedProduct] = useState("");
  const [snackTags, setSnackTags] = useState<string[]>([]);
  const [drinkTags, setDrinkTags] = useState<string[]>([]);
  const [energyBoost, setEnergyBoost] = useState("");
  const [allergyTags, setAllergyTags] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [preferredContact, setPreferredContact] = useState("Cell Phone");
  const [phone, setPhone] = useState(() => formatPhone(user.phone || ""));
  const phoneRef = useRef<HTMLInputElement>(null);

  function toggleTag(tags: string[], setTags: (t: string[]) => void, value: string) {
    if (tags.includes(value)) {
      setTags(tags.filter((t) => t !== value));
    } else {
      setTags([...tags, value]);
    }
  }

  function toggleDietary(option: string) {
    if (option === "No Restrictions") {
      setDietary(dietary.includes("No Restrictions") ? [] : ["No Restrictions"]);
      return;
    }
    setDietary((prev) =>
      prev.includes(option)
        ? prev.filter((d) => d !== option && d !== "No Restrictions")
        : [...prev.filter((d) => d !== "No Restrictions"), option]
    );
  }

  async function handleFinish() {
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          favoritePublixProduct: selectedProduct,
          favoriteSnacks: snackTags.join(", "),
          favoriteDrinks: drinkTags.join(", "),
          energyBoost,
          allergies: allergyTags.join(", "),
          dietaryRestrictions: dietary.join(", "),
          preferredContact,
          phone,
          onboardingCompleted: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onComplete();
    } catch {
      toast("error", "Couldn't save your profile — try again");
    } finally {
      setSaving(false);
    }
  }

  const selectedProductData = PUBLIX_PRODUCTS.find((p) => p.name === selectedProduct);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden">

        {/* ---- STEP 0: Welcome ---- */}
        {step === 0 && (
          <div className="p-8 text-center">
            <div className="text-5xl mb-4">🎬</div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              Welcome to the Greenroom
            </h1>
            <p className="text-sm text-text-secondary mb-8 leading-relaxed">
              Let's take 60 seconds to set up your profile so your team knows who you are,
              what you eat, and how to find you.
            </p>
            <Button size="lg" className="w-full" onClick={() => setStep(1)}>
              Get Started
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* ---- STEP 1: Favorite Publix product ---- */}
        {step === 1 && (
          <div className="p-6">
            <ProgressDots step={step} />
            <div className="mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
                Step 1 of 4
              </p>
              <h2 className="text-lg font-bold text-text-primary">Your Publix icon</h2>
              <p className="text-sm text-text-secondary mt-1">
                Pick your favorite Publix product — it becomes your avatar in the app.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6 max-h-72 overflow-y-auto overscroll-contain pr-1">
              {PUBLIX_PRODUCTS.map((product) => (
                <button
                  key={product.name}
                  onClick={() => setSelectedProduct(product.name)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl p-3 border text-center transition-all ${
                    selectedProduct === product.name
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/40 hover:bg-surface-secondary"
                  }`}
                >
                  <img src={product.icon} alt={product.name} className="h-7 w-7" />
                  <span className="text-[10px] font-medium text-text-secondary leading-tight">
                    {product.name}
                  </span>
                  {selectedProduct === product.name && (
                    <Check className="h-3 w-3 text-primary" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep(0)} className="flex-1">
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button
                size="sm"
                className="flex-[2]"
                disabled={!selectedProduct}
                onClick={() => setStep(2)}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ---- STEP 2: Favorites ---- */}
        {step === 2 && (
          <div className="p-6">
            <ProgressDots step={step} />
            <div className="mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
                Step 2 of 4
              </p>
              <h2 className="text-lg font-bold text-text-primary">Favorites</h2>
              <p className="text-sm text-text-secondary mt-1">
                What keeps you going on set? Your team will know what to grab for you.
              </p>
            </div>

            <div className="space-y-4 mb-6 max-h-80 overflow-y-auto overscroll-contain pr-3 pb-4">
              {/* Snacks */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                  🍿 Snacks
                </label>
                <PresetChips
                  presets={SNACK_PRESETS}
                  activeTags={snackTags}
                  onToggle={(p) => toggleTag(snackTags, setSnackTags, p)}
                />
                <div className="mt-2">
                  <TagInput
                    tags={snackTags}
                    onChange={setSnackTags}
                    placeholder="Add your favorite..."
                  />
                </div>
              </div>

              {/* Drinks */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                  🥤 Drinks
                </label>
                <PresetChips
                  presets={DRINK_PRESETS}
                  activeTags={drinkTags}
                  onToggle={(p) => toggleTag(drinkTags, setDrinkTags, p)}
                />
                <div className="mt-2">
                  <TagInput
                    tags={drinkTags}
                    onChange={setDrinkTags}
                    placeholder="Add your favorite..."
                  />
                </div>
              </div>

              {/* Energy Boost */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-1">
                  <Zap className="h-4 w-4 text-primary" />
                  Energy Boost
                </label>
                <p className="text-xs text-text-tertiary mb-2">
                  Give us your full order — the more specific, the better.
                </p>
                <div className="mb-2">
                  <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">
                    Quick start →
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ENERGY_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setEnergyBoost(preset + " - ");
                          setTimeout(() => {
                            const el = document.querySelector<HTMLInputElement>("[data-energy-input]");
                            el?.focus();
                            // Place cursor at end
                            if (el) {
                              const len = el.value.length;
                              el.setSelectionRange(len, len);
                            }
                          }, 0);
                        }}
                        className="rounded-full px-3 py-1 text-xs font-medium border border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary transition-all"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  data-energy-input
                  type="text"
                  value={energyBoost}
                  onChange={(e) => setEnergyBoost(e.target.value)}
                  placeholder="e.g. Iced coffee - 2 pumps sugar free vanilla, oat milk"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none/40"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="flex-1">
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button size="sm" className="flex-[2]" onClick={() => setStep(3)}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ---- STEP 3: Allergies & Dietary ---- */}
        {step === 3 && (
          <div className="p-6">
            <ProgressDots step={step} />
            <div className="mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
                Step 3 of 4
              </p>
              <h2 className="text-lg font-bold text-text-primary">Allergies & diet</h2>
              <p className="text-sm text-text-secondary mt-1">
                Your team needs to know this — especially on shoot days with catering.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Allergies
                </label>
                <TagInput
                  tags={allergyTags}
                  onChange={setAllergyTags}
                  placeholder="Type an allergy and press Enter... e.g. peanuts, shellfish"
                />
                <p className="text-[10px] text-text-tertiary mt-1">Press Enter or comma after each one</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                  <Utensils className="h-4 w-4 text-primary" />
                  Dietary preferences
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DIETARY_OPTIONS.map((option) => (
                    <button
                      key={option}
                      onClick={() => toggleDietary(option)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm border text-left transition-all ${
                        dietary.includes(option)
                          ? "border-primary bg-primary/5 text-primary font-medium"
                          : "border-border text-text-secondary hover:border-primary/40"
                      }`}
                    >
                      <div
                        className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                          dietary.includes(option) ? "bg-primary border-primary" : "border-border"
                        }`}
                      >
                        {dietary.includes(option) && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="flex-1">
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button size="sm" className="flex-[2]" onClick={() => setStep(4)}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ---- STEP 4: Contact info & preference ---- */}
        {step === 4 && (
          <div className="p-6">
            <ProgressDots step={step} />
            <div className="mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
                Step 4 of 4
              </p>
              <h2 className="text-lg font-bold text-text-primary">Contact info</h2>
              <p className="text-sm text-text-secondary mt-1">
                Confirm your details and let the team know the best way to reach you.
              </p>
            </div>

            <div className="space-y-4 mb-5">
              {/* Email — confirm, read-only */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-1.5">
                  <Mail className="h-4 w-4 text-primary" />
                  Email address
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-2">
                  <span className="text-sm text-text-primary flex-1">{user.email}</span>
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-1.5">
                  <Phone className="h-4 w-4 text-primary" />
                  Cell phone
                </label>
                <input
                  ref={phoneRef}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(555) 000-0000"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none/40"
                />
              </div>

              {/* Preferred contact method */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                  <Contact className="h-4 w-4 text-primary" />
                  Best way to reach you
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CONTACT_OPTIONS.map(({ value, label, icon: Icon, description }) => (
                    <button
                      key={value}
                      onClick={() => setPreferredContact(value)}
                      className={`flex flex-col items-center gap-2 rounded-xl p-3 border text-center transition-all ${
                        preferredContact === value
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/40 hover:bg-surface-secondary"
                      }`}
                    >
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                          preferredContact === value ? "bg-primary text-white" : "bg-surface-secondary text-text-tertiary"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-primary">{label}</p>
                        <p className="text-[10px] text-text-tertiary leading-tight">{description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep(3)} className="flex-1">
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button size="sm" className="flex-[2]" onClick={() => setStep(5)}>
                Preview my card
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ---- STEP 5: Done / card preview ---- */}
        {step === 5 && (
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-2">
                {selectedProductData
                  ? <img src={selectedProductData.icon} alt={selectedProductData.name} className="h-14 w-14" />
                  : <Utensils className="h-14 w-14 text-primary" />}
              </div>
              <h2 className="text-lg font-bold text-text-primary">Looking good!</h2>
              <p className="text-sm text-text-secondary mt-1">
                Here's your card — your team will see this on the Contacts page.
              </p>
            </div>

            {/* Card preview */}
            <div className="rounded-xl border border-border bg-surface-secondary p-4 mb-6 space-y-3">
              {/* Avatar + name */}
              <div className="flex items-center gap-3">
                <UserAvatar name={user.name} favoriteProduct={selectedProduct} size="lg" />
                <div>
                  <p className="font-semibold text-text-primary">{user.name}</p>
                  <p className="text-xs text-text-tertiary">{user.role}{user.title ? ` · ${user.title}` : ""}</p>
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2 text-text-secondary">
                  <Mail className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                  <span>{user.email}</span>
                </div>
                {phone && (
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Phone className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                    <span>{phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-text-secondary">
                  <Contact className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                  <span>Prefers {preferredContact}</span>
                </div>
              </div>

              {/* Preferences */}
              <div className="border-t border-border pt-3 space-y-1.5 text-sm">
                {selectedProduct && selectedProductData && (
                  <div className="flex items-center gap-2 text-text-secondary">
                    <img src={selectedProductData.icon} alt={selectedProductData.name} className="h-4 w-4 shrink-0" />
                    <span>{selectedProduct}</span>
                  </div>
                )}
                {snackTags.length > 0 && (
                  <div className="flex items-start gap-2 text-text-secondary">
                    <span className="shrink-0 mt-0.5">🍿</span>
                    <span>{snackTags.join(", ")}</span>
                  </div>
                )}
                {drinkTags.length > 0 && (
                  <div className="flex items-start gap-2 text-text-secondary">
                    <span className="shrink-0 mt-0.5">🥤</span>
                    <span>{drinkTags.join(", ")}</span>
                  </div>
                )}
                {energyBoost && (
                  <div className="flex items-start gap-2 text-text-secondary">
                    <Zap className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{energyBoost}</span>
                  </div>
                )}
                {allergyTags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {allergyTags.map((tag) => (
                        <span key={tag} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {dietary.length > 0 && (
                  <div className="flex items-start gap-2 text-text-secondary">
                    <Utensils className="h-3.5 w-3.5 text-text-tertiary shrink-0 mt-0.5" />
                    <span>{dietary.join(", ")}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep(4)} className="flex-1">
                <ChevronLeft className="mr-1 h-4 w-4" />
                Edit
              </Button>
              <Button
                size="sm"
                className="flex-[2]"
                loading={saving}
                onClick={handleFinish}
              >
                <Check className="mr-1.5 h-4 w-4" />
                Start using the Greenroom
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
