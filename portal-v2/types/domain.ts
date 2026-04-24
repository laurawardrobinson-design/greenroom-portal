// ============================================================
// Domain Types — the language of the production portal
// ============================================================

// --- Roles ---
export type UserRole =
  | "Admin"
  | "Producer"
  | "Studio"
  | "Vendor"
  | "Art Director"
  | "Creative Director"
  | "Post Producer"
  | "Designer"
  | "Brand Marketing Manager";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  avatarUrl: string;
  phone: string;
  title: string;
  vendorId: string | null;
  // The RBU department this user owns the weekly meeting with.
  // BMM-only today; null for every other role.
  deskDepartment: PRDepartment | null;
  favoriteDrinks: string;
  favoriteSnacks: string;
  dietaryRestrictions: string;
  allergies: string;
  energyBoost: string;
  favoritePublixProduct: string;
  lunchPlace: string;
  preferredContact: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Goals ("Growing Toward") ---
export interface UserGoal {
  id: string;
  userId: string;
  goalText: string;
  currentRoleContext: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalAdvice {
  id: string;
  goalId: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface GoalStakeholder {
  id: string;
  goalId: string;
  userId: string;
  assignedBy: string;
  createdAt: string;
  user?: { id: string; name: string; role: string; favoritePublixProduct: string };
}

export interface GoalMilestone {
  id: string;
  goalId: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
  targetDate: string | null;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
}

export interface GoalHighlight {
  id: string;
  goalId: string;
  text: string;
  links: string[];
  createdAt: string;
  files?: GoalHighlightFile[];
  feedback?: GoalHighlightFeedback[];
}

export interface GoalHighlightFile {
  id: string;
  highlightId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
}

export interface GoalHighlightFeedback {
  id: string;
  highlightId: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

// --- Campaigns ---
export type CampaignStatus =
  | "Planning"
  | "Upcoming"
  | "In Production"
  | "Post"
  | "Complete"
  | "Cancelled";

export interface Campaign {
  id: string;
  wfNumber: string;
  name: string;
  status: CampaignStatus;
  productionBudget: number;
  budgetPoolId: string | null;
  assetsDeliveryDate: string | null;
  notes: string;
  producerIds: string[];
  producerId: string | null; // = producerIds[0] ?? null — kept for backward compat
  producerRoles: Record<string, string | null>; // userId → campaign_role override
  artDirectorId: string | null;
  // Campaign-owned copy (populated from the brief; inherited by deliverables
  // and prefilled into variant runs).
  headline: string;
  cta: string;
  disclaimer: string;
  legal: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// --- Shoots (first-class entities under campaigns) ---
export type ShootType = "Photo" | "Video" | "Hybrid" | "Other";

export interface Shoot {
  id: string;
  campaignId: string;
  name: string;
  shootType: ShootType;
  location: string;
  notes: string;
  sortOrder: number;
  crewVariesByDay: boolean;
  dates: ShootDate[];
  crew: ShootCrew[];
  createdAt: string;
  updatedAt: string;
}

export interface ShootDate {
  id: string;
  shootId: string;
  shootDate: string;
  callTime: string | null;
  location: string;
  notes: string;
}

export interface ShootCrew {
  id: string;
  shootId: string;
  userId: string;
  shootDateId: string | null;
  roleOnShoot: string;
  notes: string;
  user?: AppUser;
}

// Extended type for campaign list cards
export interface CampaignListItem extends Campaign {
  nextShootDate: string | null;
  shootCount: number;
  vendorCount: number;
  shootsSummary: ShootSummary[];
  committed: number;
  producerName: string | null;
  artDirectorName: string | null;
  additionalFundsRequested: number;
  additionalFundsApproved: number;
  foodCount: number;
  propsCount: number;
  gearCount: number;
}

export interface ShootSummary {
  name: string;
  shootType: ShootType;
  dates: string[];
}

export interface CampaignDeliverable {
  id: string;
  campaignId: string;
  channel: string;
  format: string;
  width: number;
  height: number;
  aspectRatio: string;
  quantity: number;
  notes: string;
  assignedVendorId: string | null;
  // NULL inherits from campaign.primary_designer (via campaign_assignments).
  assignedDesignerId: string | null;
  // NULL = inherit from campaign; empty string = explicitly blank.
  headlineOverride: string | null;
  ctaOverride: string | null;
  disclaimerOverride: string | null;
  legalOverride: string | null;
}

// --- Vendors ---
export interface Vendor {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  category: string;
  title: string;
  specialty: string;
  taxId: string;
  active: boolean;
  onboardedDate: string | null;
  notes: string;
  favoriteDrinks: string;
  favoriteSnacks: string;
  dietaryRestrictions: string;
  allergies: string;
  energyBoost: string;
  favoritePublixProduct: string;
  createdAt: string;
  updatedAt: string;
}

// --- Vendor PO Lifecycle ---
export type CampaignVendorStatus =
  | "Invited"
  | "Estimate Submitted"
  | "Estimate Approved"
  | "PO Uploaded"
  | "PO Signed"
  | "Shoot Complete"
  | "Invoice Submitted"
  | "Invoice Pre-Approved"
  | "Invoice Approved"
  | "Paid"
  | "Rejected";

export interface CampaignVendor {
  id: string;
  campaignId: string;
  vendorId: string;
  status: CampaignVendorStatus;
  campaignRole: string | null;
  invitedAt: string;
  estimateTotal: number;
  estimateFileUrl: string | null;
  estimateFileName: string | null;
  poFileUrl: string | null;
  poSignedFileUrl: string | null;
  poNumber: string | null;
  poSignedAt: string | null;
  signatureUrl: string | null;
  signatureName: string | null;
  signedIp: string | null;
  signatureTimestamp: string | null;
  signatureFieldX: number;
  signatureFieldY: number;
  poNumberFieldX: number;
  poNumberFieldY: number;
  poAuthorizedBy: string | null;
  poAuthorizedAt: string | null;
  invoiceTotal: number;
  paymentAmount: number;
  paymentDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  vendor?: Vendor;
}

// --- Cost Categories (industry standard) ---
export type CostCategory =
  | "Talent"
  | "Styling"
  | "Equipment Rental"
  | "Studio Space"
  | "Post-Production"
  | "Travel"
  | "Catering"
  | "Props"
  | "Wardrobe"
  | "Set Design"
  | "Other";

export interface VendorEstimateItem {
  id: string;
  campaignVendorId: string;
  category: CostCategory;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
}

// --- Invoices ---
export type InvoiceParseStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface InvoiceFlag {
  type: string;
  severity: "high" | "medium" | "low";
  message: string;
}

export interface VendorInvoice {
  id: string;
  campaignVendorId: string;
  fileUrl: string;
  fileName: string;
  storagePath: string | null;
  submittedAt: string;
  parsedData: Record<string, unknown> | null;
  autoFlags: InvoiceFlag[] | null;
  parseStatus: InvoiceParseStatus;
  producerApprovedAt: string | null;
  producerApprovedBy: string | null;
  hopApprovedAt: string | null;
  hopApprovedBy: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorInvoiceItem {
  id: string;
  invoiceId: string;
  category: CostCategory;
  description: string;
  amount: number;
  matchedEstimateItemId: string | null;
  flagged: boolean;
  flagReason: string;
  sortOrder: number;
}

// --- Budget ---
export interface BudgetPool {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export type BudgetRequestStatus = "Pending" | "Approved" | "Declined";

export interface BudgetRequest {
  id: string;
  campaignId: string;
  requestedBy: string;
  amount: number;
  rationale: string;
  status: BudgetRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string;
  createdAt: string;
  campaign?: Campaign;
  requester?: AppUser;
}

// --- Gear / Inventory ---
export type GearStatus =
  | "Available"
  | "Reserved"
  | "Checked Out"
  | "Under Maintenance"
  | "In Repair";

export type GearCondition =
  | "Excellent"
  | "Good"
  | "Fair"
  | "Poor"
  | "Damaged";

export type GearCategory =
  | "Camera"
  | "Lens"
  | "Lighting"
  | "Audio"
  | "Tripod / Support"
  | "Grip"
  | "Accessories"
  | "Other"
  | "Surfaces & Backgrounds"
  | "Tableware"
  | "Linens & Textiles"
  | "Cookware & Small Wares"
  | "Decorative Items"
  | "Furniture";

export interface GearItem {
  id: string;
  name: string;
  section: "Gear" | "Props";
  category: GearCategory;
  brand: string;
  model: string;
  serialNumber: string;
  qrCode: string;
  rfidTag: string | null;
  status: GearStatus;
  condition: GearCondition;
  purchaseDate: string | null;
  purchasePrice: number;
  warrantyExpiry: string | null;
  imageUrl: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface GearCheckout {
  id: string;
  gearItemId: string;
  userId: string;
  campaignId: string | null;
  checkedOutAt: string;
  checkedInAt: string | null;
  dueDate: string | null;
  conditionOut: GearCondition;
  conditionIn: GearCondition | null;
  notes: string;
  gearItem?: GearItem;
  user?: AppUser;
  campaign?: Campaign;
}

export type ReservationStatus =
  | "Confirmed"
  | "Cancelled"
  | "Checked Out"
  | "Completed";

export interface GearReservation {
  id: string;
  gearItemId: string;
  userId: string;
  campaignId: string | null;
  campaignName?: string | null;
  startDate: string;
  endDate: string;
  status: ReservationStatus;
  notes: string;
  createdAt: string;
  gearItem?: GearItem;
  user?: AppUser;
}

export interface GearKit {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  isFavorite: boolean;
  createdAt: string;
  items?: GearItem[];
}

export type MaintenanceType = "Scheduled" | "Repair";
export type MaintenanceStatus =
  | "Scheduled"
  | "In Progress"
  | "Sent for Repair"
  | "Completed"
  | "Cancelled";

export interface GearMaintenance {
  id: string;
  gearItemId: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  description: string;
  cost: number;
  performedBy: string | null;
  scheduledDate: string | null;
  completedDate: string | null;
  nextDueDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// --- Files ---
export type AssetCategory =
  | "Shot List"
  | "Concept Deck"
  | "Reference"
  | "Product Info"
  | "Contract"
  | "Estimate"
  | "PO"
  | "Invoice"
  | "Insurance"
  | "Legal"
  | "Deliverable"
  | "Other";

// "Fun" documents are creative: Shot List, Concept Deck, Reference, Product Info
// "Boring" documents are business: Contract, Estimate, PO, Invoice, Insurance, Legal
export const FUN_DOCUMENT_CATEGORIES: AssetCategory[] = [
  "Shot List",
  "Concept Deck",
  "Reference",
  "Product Info",
];

export const BORING_DOCUMENT_CATEGORIES: AssetCategory[] = [
  "Contract",
  "Estimate",
  "PO",
  "Invoice",
  "Insurance",
  "Legal",
];

export interface CampaignAsset {
  id: string;
  campaignId: string;
  uploadedBy: string;
  vendorId: string | null;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  category: AssetCategory;
  createdAt: string;
}

// --- Shot List ---
export type ShotStatus = "Pending" | "Complete" | "Needs Retouching" | "Cancelled";

export interface ShotListSetup {
  id: string;
  campaignId: string;
  name: string;
  description: string;
  location: string;
  mediaType: string;
  sortOrder: number;
  shots: ShotListShot[];
  createdAt: string;
  updatedAt: string;
}

export type ShotVariantType = "hero_still" | "motion" | "social_vertical" | "other";
export type ShotOrientation = "horizontal" | "vertical" | "square" | "custom";
export type ShotRetouchLevel = "comp" | "light" | "heavy";

export interface ShotListShot {
  id: string;
  setupId: string;
  campaignId: string;
  name: string;
  description: string;
  angle: string;
  mediaType: string;
  location: string;
  referenceImageUrl: string | null;
  status: ShotStatus;
  completedAt: string | null;
  completedBy: string | null;
  notes: string;
  talent: string;
  props: string;
  wardrobe: string;
  surface: string;
  lighting: string;
  priority: string;
  retouchingNotes: string;
  sortOrder: number;
  // Wave 2 additions
  variantType: ShotVariantType | null;
  orientation: ShotOrientation | null;
  retouchLevel: ShotRetouchLevel | null;
  heroSku: string | null;
  isHero: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  approvedSnapshot: Record<string, unknown> | null;
  approvalNotes: string;
  needsReapproval: boolean;
  deliverableLinks: ShotDeliverableLink[];
  productLinks: ShotProductLink[];
  createdAt: string;
  updatedAt: string;
}

// User per-campaign preferences (Wave 2)
export type ShotListDensity = "detailed" | "on_set";

export interface UserCampaignPreferences {
  id: string;
  userId: string;
  campaignId: string;
  shotListDensity: ShotListDensity;
  createdAt: string;
  updatedAt: string;
}

export interface ShotDeliverableLink {
  id: string;
  shotId: string;
  deliverableId: string;
}

export interface ShotProductLink {
  id: string;
  shotId: string;
  campaignProductId: string;
  notes: string;
  quantity: string;
}

// --- Product Directory ---
export type ProductDepartment =
  | "Deli"
  | "Bakery"
  | "Meat-Seafood"
  | "Produce"
  | "Grocery"
  | "Other";

export type ProductLifecyclePhase =
  | "planning"
  | "coming_soon"
  | "live"
  | "discontinued";

export const PRODUCT_LIFECYCLE_PHASES: ProductLifecyclePhase[] = [
  "planning",
  "coming_soon",
  "live",
  "discontinued",
];

export interface Product {
  id: string;
  name: string;
  department: ProductDepartment;
  itemCode: string | null;
  description: string;
  shootingNotes: string;
  restrictions: string;
  pcomLink: string | null;
  rpGuideUrl: string | null;
  imageUrl: string | null;
  lifecyclePhase: ProductLifecyclePhase;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CampaignProductRole = "hero" | "secondary";

// --- Product reference images (the quality-standard paper trail) ---
export type ProductImageType = "reference" | "sample" | "approved";

export const PRODUCT_IMAGE_TYPE_LABELS: Record<ProductImageType, string> = {
  reference: "Reference",
  sample: "RBU sample",
  approved: "Approved",
};

export const PRODUCT_IMAGE_TYPE_DESCRIPTIONS: Record<ProductImageType, string> = {
  reference: "What 'good' looks like — the standard to meet.",
  sample: "RBU's working attempt at the product.",
  approved: "Promoted to committed standard.",
};

export interface ProductReferenceImage {
  id: string;
  productId: string;
  imageType: ProductImageType;
  fileUrl: string;
  storagePath: string | null;
  notes: string;
  uploadedByUserId: string | null;
  uploadedByUserName: string | null;
  uploadedViaRbuDepartment: PRDepartment | null;
  createdAt: string;
}

export interface CampaignProduct {
  id: string;
  campaignId: string;
  productId: string;
  notes: string;
  sortOrder: number;
  role: CampaignProductRole | null;
  product?: Product;
}

// --- Wardrobe ---
export type WardrobeCategory =
  | "Tops"
  | "Aprons"
  | "Headwear"
  | "Bottoms"
  | "Outerwear"
  | "Footwear"
  | "Accessories"
  | "Other";

export type WardrobeStatus = "Available" | "Reserved" | "Checked Out";
export type WardrobeCondition = "Excellent" | "Good" | "Fair" | "Poor" | "Damaged";

export interface WardrobeItem {
  id: string;
  name: string;
  category: WardrobeCategory;
  description: string;
  shootingNotes: string;
  restrictions: string;
  guideUrl: string | null;
  imageUrl: string | null;
  status: WardrobeStatus;
  condition: WardrobeCondition;
  qrCode: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WardrobeCheckout {
  id: string;
  wardrobeItemId: string;
  userId: string | null;
  campaignId: string | null;
  checkedOutAt: string;
  checkedInAt: string | null;
  dueDate: string | null;
  conditionOut: WardrobeCondition;
  conditionIn: WardrobeCondition | null;
  notes: string;
  createdAt: string;
  wardrobeItem?: WardrobeItem;
  userName?: string;
}

export interface WardrobeReservation {
  id: string;
  wardrobeItemId: string;
  userId: string | null;
  campaignId: string | null;
  startDate: string;
  endDate: string;
  status: "Confirmed" | "Cancelled" | "Checked Out" | "Completed";
  notes: string;
  createdAt: string;
  updatedAt: string;
  wardrobeItem?: WardrobeItem;
}

// --- Wardrobe Units (physical backstock) ---
export type UnitSize = "XS" | "S" | "M" | "L" | "XL" | "2XL" | "3XL" | "One Size" | "Other";
export type UnitGender = "Men's" | "Women's" | "Unisex";
export type JobClassItemGender = "All" | "Men's" | "Women's";

export interface WardrobeUnit {
  id: string;
  wardrobeItemId: string;
  size: UnitSize;
  gender: UnitGender;
  status: WardrobeStatus;
  condition: WardrobeCondition;
  qrCode: string | null;
  notes: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  wardrobeItem?: WardrobeItem;
}

// --- Job Classes ---
export interface JobClass {
  id: string;
  name: string;
  department: string;
  standards: string;
  restrictions: string;
  referenceUrl: string | null;
  imageUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items?: JobClassItem[];
}

export interface JobClassItem {
  id: string;
  jobClassId: string;
  wardrobeItemId: string;
  notes: string;
  sortOrder: number;
  gender: JobClassItemGender;
  optionGroup: string | null;
  required: boolean;
  createdAt: string;
  wardrobeItem?: WardrobeItem;
}

export interface JobClassNote {
  id: string;
  jobClassId: string;
  text: string;
  authorId: string | null;
  authorName: string;
  campaignId: string | null;
  createdAt: string;
}

// --- Campaign Gear ---
export interface CampaignGearLink {
  id: string;
  campaignId: string;
  gearItemId: string;
  notes: string;
  gearItem?: GearItem;
}

// --- Attention System ---
export type AttentionLevel = "urgent" | "warning" | "info";

export interface AttentionItem {
  level: AttentionLevel;
  category: string;
  message: string;
  action?: string; // section ID to scroll to when clicked
}

// --- Notifications (persistent, per-user) ---
export type NotificationType =
  | "status_change"
  | "shoot_upcoming"
  | "vendor_estimate"
  | "po_uploaded"
  | "invoice_submitted"
  | "invoice_approved"
  | "budget_alert"
  | "assets_due"
  | "campaign_created"
  | "goal_highlight"
  | "goal_stale_checkin";

export interface Notification {
  id: string;
  userId: string;
  campaignId: string | null;
  type: NotificationType;
  level: AttentionLevel;
  title: string;
  body: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  campaign?: { id: string; wfNumber: string; name: string };
}

// --- Call Sheet (computed DTO passed to PDF generator / mailto) ---
export interface CallSheetCrewEntry {
  name: string;
  role: string;
  phone: string;
  email: string;
  callTime: string | null;
}

export interface CallSheetData {
  campaignName: string;
  wfNumber: string;
  shootDate: string;
  location: string;
  callTime: string | null;
  crew: CallSheetCrewEntry[];
  vendors: { company: string; contact: string; phone: string; email: string; role: string }[];
  deliverables: { channel: string; format: string; dimensions: string }[];
  notes: string;
  producer: { name: string; phone: string; email: string } | null;
}

// --- Call Sheet (persisted) ---
// Wave 1 of PRODUCER_DOCS_IMPLEMENTATION_PLAN.md. These types back
// the call_sheets / call_sheet_versions / call_sheet_distributions /
// call_sheet_attachments tables (migration 094).

export type CallSheetStatus = "draft" | "published" | "archived";
export type CallSheetTier = "full" | "redacted";
export type CallSheetChannel = "email" | "in_portal";
export type CallSheetAttachmentKind =
  | "talent_release"
  | "minor_release"
  | "location_permit"
  | "coi"
  | "safety_bulletin"
  | "other";

export type CallSheetContactVisibility = "full" | "redacted";

export interface CallSheetCrewRow {
  id: string;
  name: string;
  role: string;
  dept: string;
  phone: string;
  email: string;
  callTime: string;
  contactVisibility: CallSheetContactVisibility;
  sourceUserId?: string | null;
  sourceVendorId?: string | null;
}

export interface CallSheetTalentRow {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  callTime: string;
  makeupWardrobeCall: string;
  pickupTime: string;
  agency: string;
  sourceVendorId?: string | null;
}

export interface CallSheetLocationRow {
  id: string;
  label: string;
  address: string;
  mapLink: string;
  loadIn: string;
  parking: string;
}

// Shape of call_sheets.content_draft and call_sheet_versions.payload.
// Stored as jsonb so we can evolve the field set without migrations.
export interface CallSheetContent {
  // Header
  companyName: string;
  companyAddress: string;

  // Shoot logistics
  location: string;
  parkingDirections: string;
  generalCallTime: string;
  shootingCallTime: string;
  breakfastTime: string;
  lunchTime: string;
  lunchVenue: string;
  estimatedWrap: string;
  companyMoves: string;
  walkieChannels: string;

  // Environmental
  weatherNotes: string;
  weatherCachedAt: string | null;
  sunrise: string;
  sunset: string;
  goldenHour: string;

  // Safety block (required for publish)
  emergencyHospital: string;
  emergencyAddress: string;
  emergencyPhone: string;
  urgentCareName: string;
  urgentCarePhone: string;
  policeNonEmergencyPhone: string;
  onSetMedic: string;
  allergenBulletin: string;
  safetyReminders: string;

  // People + places
  crew: CallSheetCrewRow[];
  talent: CallSheetTalentRow[];
  locations: CallSheetLocationRow[];

  // Instructions
  specialInstructions: string;

  // Producer snapshot (frozen on publish)
  producer: { name: string; phone: string; email: string } | null;
}

export interface CallSheetDeliveryBlock {
  docId: string;
  docNumber: string;
  docStatus: string;
  department: string;
  pickupTime: string;
  pickupPerson: string;
  items: Array<{ name: string; quantity: number; notes: string }>;
}

export interface CallSheetRow {
  id: string;
  campaignId: string;
  shootDateId: string | null;
  shootDate: string;
  status: CallSheetStatus;
  contentDraft: CallSheetContent;
  currentVersionId: string | null;
  currentVNumber: number | null;
  liveDeliveries: CallSheetDeliveryBlock[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallSheetVersion {
  id: string;
  callSheetId: string;
  vNumber: number;
  payload: CallSheetContent;
  publishedBy: string | null;
  publishedAt: string;
  supersededAt: string | null;
}

export interface CallSheetDistribution {
  id: string;
  versionId: string;
  recipientName: string;
  recipientEmail: string;
  tier: CallSheetTier;
  channel: CallSheetChannel;
  ackToken: string;
  sentAt: string;
  ackedAt: string | null;
  sentBy: string | null;
}

export interface CallSheetAttachment {
  id: string;
  callSheetId: string;
  kind: CallSheetAttachmentKind;
  label: string;
  fileUrl: string;
  expiresAt: string | null;
  required: boolean;
  uploadedBy: string | null;
  createdAt: string;
}

// --- Computed types ---
export interface CampaignFinancials {
  committed: number;
  vendorCommitted: number;
  crewCommitted: number;
  spent: number;
  budget: number;
  remaining: number;
}

export interface BudgetPoolSummary extends BudgetPool {
  allocated: number;
  committed: number;
  spent: number;
  remaining: number;
}

export interface CategorySpending {
  category: string;
  total: number;
}

// --- Crew Bookings (Paymaster Track) ---
export type CrewBookingStatus =
  | "Draft"
  | "Pending Approval"
  | "Confirmed"
  | "Completed"
  | "Cancelled";

export type ClassificationType = "1099" | "W2 Paymaster" | "Loan Out";

export interface RateCard {
  id: string;
  role: string;
  dayRate: number;
  notes: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrewBooking {
  id: string;
  campaignId: string;
  vendorId: string | null;
  userId: string | null;
  role: string;
  dayRate: number;
  classification: ClassificationType;
  status: CrewBookingStatus;
  bookedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  // Joined data
  vendor?: Vendor;
  user?: AppUser;
  dates: CrewBookingDate[];
  payment?: CrewPayment;
  // Computed
  plannedDays?: number;
  confirmedDays?: number;
  totalAmount?: number;
}

export interface CrewBookingDate {
  id: string;
  bookingId: string;
  shootDate: string;
  confirmed: boolean | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  notes: string;
  createdAt: string;
}

// --- Crew Payments ---

export type CrewPaymentStatus =
  | "Pending Approval"
  | "Approved"
  | "Sent to Paymaster"
  | "Paid";

export interface CrewPayment {
  id: string;
  bookingId: string;
  totalDays: number;
  totalAmount: number;
  status: CrewPaymentStatus;
  notes: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}
// --- Payment Batches ---

export type PaymentBatchStatus = "Draft" | "Sent" | "Confirmed";

export interface PaymentBatchItem {
  id: string;
  batchId: string;
  crewPaymentId: string;
  amount: number;
  createdAt: string;
  // enriched
  personName?: string;
  role?: string;
  campaignName?: string;
  wfNumber?: string;
  campaignId?: string;
  totalDays?: number;
  dayRate?: number;
  classification?: string;
}

export interface PaymentBatch {
  id: string;
  name: string;
  status: PaymentBatchStatus;
  totalAmount: number;
  itemCount: number;
  createdBy: string;
  sentAt: string | null;
  confirmedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  items?: PaymentBatchItem[];
}

// --- Studio Management ---

export type StudioSpaceType =
  | "shooting_bay"
  | "set_kitchen"
  | "prep_kitchen"
  | "wardrobe"
  | "multipurpose"
  | "conference"
  | "equipment_storage"
  | "prop_storage";

export interface StudioSpace {
  id: string;
  name: string;
  type: StudioSpaceType;
  capacity: number | null;
  notes: string | null;
  sortOrder: number;
}

export interface SpaceReservation {
  id: string;
  campaignId: string;
  spaceId: string;
  reservedDate: string;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  reservedBy: string;
  createdAt: string;
  updatedAt: string;
  space?: StudioSpace;
  campaign?: { id: string; wfNumber: string; name: string };
  reservedByUser?: { id: string; name: string };
}

export type MealType = "crafty" | "breakfast" | "lunch" | "dinner" | "snacks";
export type MealLocation = "greenroom" | "outside";
export type MealStatus = "pending" | "ordered" | "confirmed" | "received" | "set";
export type MealHandlerRole = "studio" | "producer";

export interface ShootMeal {
  id: string;
  campaignId: string;
  shootDate: string;
  mealType: MealType;
  location: MealLocation;
  handlerRole: MealHandlerRole;
  handlerId: string | null;
  headcount: number | null;
  dietaryNotes: string | null;
  preferences: string | null;
  vendor: string | null;
  deliveryTime: string | null;
  notes: string | null;
  status: MealStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  campaign?: { id: string; wfNumber: string; name: string };
  handler?: { id: string; name: string };
}

// --- Onboarding ---

export type OnboardingStatus = "complete" | "partial" | "none";

export interface OnboardingChecklist {
  id: string;
  vendorId: string;
  itemName: string;
  completed: boolean;
  completedDate: string | null;
  expiresAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Post Workflow — Edit Rooms & Hard Drive Management
// ============================================================

// --- Edit Rooms ---

export interface EditRoom {
  id: string;
  name: string;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface EditRoomReservation {
  id: string;
  roomId: string;
  roomName?: string;
  campaignId: string | null;
  campaignWfNumber?: string | null;
  campaignName?: string | null;
  editorName: string;
  editorUserId: string | null;
  reservedDate: string;
  groupId: string;
  status: "confirmed" | "cancelled" | "completed";
  notes: string | null;
  reservedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Hard Drives ---

export type DriveCondition = "Good" | "Fair" | "Poor" | "Damaged";
export type DriveStatus = "Available" | "Reserved" | "Checked Out" | "Pending Backup/Wipe" | "Retired";
export type DriveLocation = "Corporate" | "With Editor" | "On Set" | "Other";
export type DriveType = "HDD" | "HDD - Superspeed" | "Portable SSD";
export type CheckoutRole = "shooter" | "media_manager";
export type DriveCheckoutSessionStatus = "active" | "pending_backup" | "partial_return" | "completed";

export interface MediaDrive {
  id: string;
  brand: string;
  model: string | null;
  storageSize: string;
  driveType: DriveType;
  purchaseDate: string | null;
  retirementDate: string | null;
  condition: DriveCondition;
  status: DriveStatus;
  location: DriveLocation;
  assignedToUserId: string | null;
  assignedToUserName?: string | null;
  isPermanentlyAssigned: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** true if retirement_date is within 90 days from today */
  nearingRetirement?: boolean;
  /** true if retirement_date is in the past */
  pastRetirement?: boolean;
}

export interface DriveCheckoutItem {
  id: string;
  sessionId: string;
  driveId: string;
  drive?: MediaDrive;
  checkoutRole: CheckoutRole;
  conditionOut: DriveCondition | null;
  conditionIn: DriveCondition | null;
  actualReturnDate: string | null;
  dataOffloadedBackedUp: boolean;
  backupLocation: string | null;
  driveWiped: boolean;
  clearForReuse: boolean;
  returnedAt: string | null;
  notes: string | null;
}

export interface DriveCheckoutSession {
  id: string;
  campaignId: string | null;
  projectDisplayName: string | null;
  shootDate: string | null;
  checkoutDate: string;
  expectedReturnDate: string | null;
  checkedOutBy: string | null;
  checkedOutByName?: string | null;
  status: DriveCheckoutSessionStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items?: DriveCheckoutItem[];
  campaign?: {
    id: string;
    wfNumber: string;
    name: string;
    brand: string | null;
  } | null;
}

export interface DriveReservation {
  id: string;
  driveId: string;
  drive?: MediaDrive;
  campaignId: string;
  shootDate: string;
  reservedBy: string | null;
  status: "reserved" | "cancelled" | "converted_to_checkout";
  notes: string | null;
  createdAt: string;
}

export interface PostWorkflowSummary {
  editRoomsBookedToday: number;
  drivesCheckedOut: number;
  drivesPendingBackup: number;
  drivesNearingRetirement: number;
  drivesPastRetirement: number;
  retirementAlerts: Array<{
    id: string;
    brand: string;
    model: string | null;
    storageSize: string;
    retirementDate: string;
    pastRetirement: boolean;
  }>;
}

// ============================================================
// Asset Studio — versioned brand tokens, templates, variant runs
// ============================================================

// --- Brand Tokens ---

export interface BrandTokenColors {
  primary?: string;
  primary_hover?: string;
  primary_light?: string;
  sidebar?: string;
  sidebar_hover?: string;
  surface?: string;
  surface_secondary?: string;
  border?: string;
  text_primary?: string;
  text_secondary?: string;
  success?: string;
  warning?: string;
  error?: string;
  [key: string]: string | undefined;
}

export interface BrandTokenTypography {
  font_family?: string;
  scale?: Record<string, number>;
  weights?: Record<string, number>;
}

export interface BrandTokenLogo {
  primary_url?: string;
  wordmark_only?: boolean;
  min_width_px?: number;
  clear_space_pct?: number;
}

export interface BrandTokenSpacing {
  base_unit?: number;
  radius_sm?: number;
  radius_md?: number;
  radius_lg?: number;
}

export interface BrandTokenPayload {
  colors?: BrandTokenColors;
  typography?: BrandTokenTypography;
  logo?: BrandTokenLogo;
  spacing?: BrandTokenSpacing;
}

export interface BrandTokenSet {
  id: string;
  brand: string;
  version: number;
  isActive: boolean;
  notes: string;
  tokens: BrandTokenPayload;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Templates ---

export type TemplateStatus = "draft" | "published" | "archived";
export type TemplateLayerType = "text" | "image" | "logo" | "shape";

export interface TemplateLayerProps {
  // Shared
  fit?: "cover" | "contain" | "fill";
  // Text-specific
  font_size?: number;
  font_weight?: number;
  font_family?: string;
  color?: string;
  align?: "left" | "center" | "right";
  vertical_align?: "top" | "middle" | "bottom";
  line_height?: number;
  letter_spacing?: number;
  // Shape-specific
  background_color?: string;
  border_color?: string;
  border_width?: number;
  border_radius?: number;
  [key: string]: unknown;
}

export interface TemplateLayer {
  id: string;
  templateId: string;
  name: string;
  layerType: TemplateLayerType;
  isDynamic: boolean;
  isLocked: boolean;
  dataBinding: string;
  staticValue: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  rotationDeg: number;
  zIndex: number;
  sortOrder: number;
  props: TemplateLayerProps;
  /**
   * Per-locale content overrides for text layers. Empty string or missing
   * key means "fall back to staticValue / dataBinding resolution."
   * Shape: { "es-US": "Hola", "fr-CA": "Bonjour" }.
   */
  locales: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateOutputSpec {
  id: string;
  templateId: string;
  label: string;
  width: number;
  height: number;
  channel: string;
  format: "png" | "jpg" | "webp";
  sortOrder: number;
  createdAt: string;
}

export interface AssetTemplate {
  id: string;
  name: string;
  description: string;
  status: TemplateStatus;
  category: string;
  brandTokensId: string | null;
  thumbnailUrl: string | null;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  currentVersionId: string | null;
  // Back-link to the deliverable this template was built for (Sprint 7).
  // NULL for standalone templates.
  campaignDeliverableId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Optional joined
  layers?: TemplateLayer[];
  outputSpecs?: TemplateOutputSpec[];
  brandTokens?: BrandTokenSet | null;
  versions?: TemplateVersion[];
}

// Snapshot of a template at publish time — used to freeze a run's view
// of the template so subsequent edits don't change already-rendered
// variants' provenance. Shape matches what's read back from template_versions.snapshot.
export interface TemplateVersionSnapshot {
  template: {
    name: string;
    description: string;
    category: string;
    brandTokensId: string | null;
    canvasWidth: number;
    canvasHeight: number;
    backgroundColor: string;
  };
  layers: TemplateLayer[];
  outputSpecs: TemplateOutputSpec[];
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  label: string;
  notes: string;
  snapshot: TemplateVersionSnapshot;
  createdBy: string | null;
  createdAt: string;
}

// --- Variant Runs ---

export type VariantRunStatus =
  | "queued"
  | "rendering"
  | "completed"
  | "failed"
  | "cancelled";

export interface VariantRunBindings {
  // The campaign products selected for this run.
  campaign_product_ids?: string[];
  // The output spec ids selected for this run (subset of template's specs).
  output_spec_ids?: string[];
  // Locales to render this run for. Fan-out count = products × specs × locales.
  // Defaults server-side to ['en-US'] if omitted. Stored alongside the run row
  // in variant_runs.locale_codes (not just bindings) for queryability.
  locale_codes?: string[];
  // Free-form copy overrides keyed by binding path (e.g. { "product.price": "$3.99" })
  // Applied to every variant in the run unless overridden by copy_overrides_by_product.
  copy_overrides?: Record<string, string>;
  // Per-campaign-product copy overrides — keyed by campaign_product_id, value is the
  // same shape as copy_overrides. Merged on top of the global copy_overrides so each
  // row can carry its own headline / price / badge without affecting its siblings.
  // This is the Storyteq "Batch Creator" pattern.
  copy_overrides_by_product?: Record<string, Record<string, string>>;
  // Per-campaign-product DAM asset image overrides — keyed by campaign_product_id.
  // When present, the variant uses this URL instead of the product's default image_url.
  // Sourced from campaign-scoped DAM assets picked in the run builder.
  image_overrides_by_product?: Record<string, string>;
  [key: string]: unknown;
}

export interface VariantRun {
  id: string;
  templateId: string | null;
  templateVersionId: string | null;
  campaignId: string | null;
  name: string;
  status: VariantRunStatus;
  totalVariants: number;
  completedVariants: number;
  failedVariants: number;
  /** Locales this run will fan out across. Server default is ['en-US']. */
  localeCodes: string[];
  bindings: VariantRunBindings;
  notes: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  // Joined
  template?: AssetTemplate | null;
  campaign?: { id: string; wfNumber: string; name: string; brand: string | null } | null;
  variants?: Variant[];
}

// --- Variants ---

export type VariantStatus =
  | "pending"
  | "rendering"
  | "rendered"
  | "approved"
  | "rejected"
  | "failed";

export interface VariantBindings {
  product?: {
    id?: string;
    name?: string;
    image_url?: string;
    department?: string;
    item_code?: string | null;
  };
  copy?: Record<string, string>;
  /** Locale this variant should resolve text layer translations against. */
  locale?: string;
  [key: string]: unknown;
}

export interface Variant {
  id: string;
  runId: string;
  templateId: string | null;
  outputSpecId: string | null;
  campaignProductId: string | null;
  width: number;
  height: number;
  status: VariantStatus;
  assetUrl: string | null;
  storagePath: string | null;
  thumbnailUrl: string | null;
  /**
   * Locale this variant was rendered in. Null on pre-073 variants and on
   * single-locale runs that never set the column. UI treats null as "default".
   */
  localeCode: string | null;
  bindings: VariantBindings;
  errorMessage: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string;
  createdAt: string;
  updatedAt: string;
  // Joined
  outputSpec?: TemplateOutputSpec | null;
  product?: { id: string; name: string; imageUrl: string | null } | null;
}

// --- DAM Placeholder (prototype bridge to external DAM) ---

export type DamAssetStatus =
  | "ingested"
  | "retouching"
  | "retouched"
  | "versioning"
  | "ready_for_activation"
  | "archived";

export type DamPhotoshopStatus =
  | "not_requested"
  | "requested"
  | "in_progress"
  | "completed";

export interface DamAssetVersion {
  id: string;
  damAssetId: string;
  versionNumber: number;
  label: string;
  stage: DamAssetStatus;
  fileUrl: string;
  metadata: Record<string, unknown>;
  notes: string;
  createdBy: string | null;
  createdAt: string;
}

export type DamSyncStatus =
  | "pending_sync"
  | "synced"
  | "stale"
  | "error";

export interface DamAssetCampaignRef {
  id: string;
  wfNumber: string;
  name: string;
  brand: string | null;
}

export interface DamAsset {
  id: string;
  campaignId: string | null;
  sourceCampaignAssetId: string | null;
  name: string;
  fileUrl: string;
  fileType: string;
  status: DamAssetStatus;
  photoshopStatus: DamPhotoshopStatus;
  photoshopNote: string;
  lastPhotoshopRequestAt: string | null;
  retouchingNotes: string;
  metadata: Record<string, unknown>;
  externalDamId: string | null;
  externalDamSystem: string;
  syncStatus: DamSyncStatus;
  lastSyncedAt: string | null;
  syncError: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  campaign?: DamAssetCampaignRef | null;
  campaigns: DamAssetCampaignRef[];
  versions?: DamAssetVersion[];
  productSkus?: string[];
}

export interface DamAssetSource {
  id: string;
  campaignId: string;
  campaignName: string;
  campaignWfNumber: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  category: AssetCategory;
  createdAt: string;
  ingested: boolean;
  damAssetId: string | null;
}

export interface DamAssetLibraryResponse {
  assets: DamAsset[];
  sourceAssets: DamAssetSource[];
}

export type DamSyncJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface DamSyncJobItem {
  id: string;
  jobId: string;
  damAssetId: string;
  damAssetVersionId: string;
  status: DamSyncJobStatus;
  attempts: number;
  nextAttemptAt: string | null;
  externalDamId: string | null;
  syncedAt: string | null;
  lastError: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DamSyncJob {
  id: string;
  damAssetId: string;
  latestVersionId: string | null;
  idempotencyKey: string;
  status: DamSyncJobStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  workerId: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items: DamSyncJobItem[];
}

export type WorkflowEntityType = "dam_asset" | "deliverable";

export type WorkflowTransitionKind = "advance" | "return" | "reject";

export interface WorkflowStage {
  key: string;
  label: string;
  queueRoles: UserRole[];
}

export interface WorkflowTransition {
  action: string;
  label: string;
  kind: WorkflowTransitionKind;
  from: string;
  to: string;
  roles: UserRole[];
}

export interface WorkflowDefinition {
  id: string;
  key: string;
  entityType: WorkflowEntityType;
  name: string;
  version: number;
  description: string;
  initialStage: string;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowInstanceStatus = "active" | "completed" | "cancelled";

export interface WorkflowInstance {
  id: string;
  definitionId: string | null;
  entityType: WorkflowEntityType;
  entityId: string;
  campaignId: string | null;
  currentStage: string;
  status: WorkflowInstanceStatus;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  lastEventAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEvent {
  id: string;
  instanceId: string;
  definitionId: string | null;
  entityType: WorkflowEntityType;
  entityId: string;
  fromStage: string | null;
  toStage: string;
  action: string;
  actorId: string | null;
  actorRole: UserRole | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowInstanceDetails {
  definition: WorkflowDefinition;
  instance: WorkflowInstance;
  events: WorkflowEvent[];
  availableTransitions: WorkflowTransition[];
}

export interface MyWorkQueueItem {
  workflowInstanceId: string;
  entityType: WorkflowEntityType;
  entityId: string;
  campaignId: string | null;
  campaign: DamAssetCampaignRef | null;
  // Populated when entityType === "dam_asset".
  asset: {
    id: string;
    name: string;
    status: DamAssetStatus;
    syncStatus: DamSyncStatus;
    updatedAt: string;
  } | null;
  // Populated when entityType === "deliverable".
  deliverable: {
    id: string;
    channel: string;
    format: string;
    width: number;
    height: number;
    aspectRatio: string;
    quantity: number;
    notes: string;
    assignedDesignerId: string | null;
    templateId: string | null;
  } | null;
  currentStage: string;
  stageQueueRoles: UserRole[];
  availableTransitions: WorkflowTransition[];
  recentEvents: WorkflowEvent[];
  updatedAt: string;
}

// --- Render Jobs ---

export type RenderJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type RenderJobItemStatus =
  | "queued"
  | "rendering"
  | "rendered"
  | "failed"
  | "skipped";

export interface RenderJobProgress {
  total: number;
  done: number;
  failed: number;
  queued: number;
  rendering: number;
}

export interface RenderJobItem {
  id: string;
  jobId: string;
  variantId: string;
  status: RenderJobItemStatus;
  attempts: number;
  workerId: string | null;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RenderJob {
  id: string;
  runId: string;
  priority: number;
  status: RenderJobStatus;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  progress: RenderJobProgress;
}

// --- Asset Studio audit log ---

export type AuditTargetType =
  | "variant"
  | "variant_run"
  | "template"
  | "brand_tokens"
  | "dam_asset";

export interface AuditLogEvent {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  actorName: string | null; // resolved from users join at read time
  targetType: AuditTargetType;
  targetId: string;
  action: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// --- Product Request Documents (v2) ---

export type PRDocStatus = "draft" | "submitted" | "forwarded" | "fulfilled" | "cancelled";

export type PRDepartment = "Bakery" | "Produce" | "Deli" | "Meat-Seafood" | "Grocery";

export const PR_DEPARTMENTS: PRDepartment[] = [
  "Bakery",
  "Deli",
  "Produce",
  "Meat-Seafood",
  "Grocery",
];

export const PR_DEPARTMENT_LABELS: Record<PRDepartment, string> = {
  Bakery: "Bakery",
  Produce: "Produce",
  Deli: "Deli",
  "Meat-Seafood": "Meat & Seafood",
  Grocery: "Grocery",
};

export interface PRItem {
  id: string;
  sectionId: string;
  productId: string | null;
  name: string;
  quantity: number;
  size: string;
  specialInstructions: string;
  fromShotList: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  product?: Product;
}

export interface PRDeptSection {
  id: string;
  docId: string;
  department: PRDepartment;
  dateNeeded: string | null;
  timeNeeded: string;
  pickupPerson: string;
  pickupPhone: string;
  publicToken: string;
  sortOrder: number;
  createdAt: string;
  items: PRItem[];
}

export interface PRDoc {
  id: string;
  docNumber: string;
  campaignId: string;
  shootDate: string;
  shootDateId: string | null;
  status: PRDocStatus;
  submittedBy: string | null;
  submittedAt: string | null;
  forwardedBy: string | null;
  forwardedAt: string | null;
  fulfilledAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  sections: PRDeptSection[];
  campaign?: { id: string; name: string; wfNumber: string };
  submittedByName?: string | null;
}

export interface PREvent {
  id: string;
  docId: string;
  actorId: string | null;
  actorName?: string | null;
  fromStatus: PRDocStatus | null;
  toStatus: PRDocStatus | null;
  comment: string;
  createdAt: string;
}

export const PR_STATUS_LABELS: Record<PRDocStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  forwarded: "Sent",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

// --- Unified contact picker (users + vendors) ---

export type ContactPickerSource = "user" | "vendor";

export interface ContactPickerResult {
  id: string;
  source: ContactPickerSource;
  name: string;
  phone: string;
  email: string;
  subtitle: string;
}

// --- Public (tokenized) PR section view ---
// Shared between the server route and the public /pr/view/[token] page.

export interface PRSectionPublicView {
  docNumber: string;
  status: PRDocStatus;
  campaign: { id: string; name: string; wfNumber: string; brand: string };
  shoot: { date: string; callTime: string; location: string };
  notes: string;
  section: PRDeptSection;
}

// --- Department calendar (one tokenized calendar per dept + master) ---

export interface DeptCalendarEntry {
  docId: string;
  docNumber: string;
  status: PRDocStatus;
  department: PRDepartment;
  shootDate: string;
  campaign: { id: string; name: string; wfNumber: string; brand: string };
  itemCount: number;
  pickupDate: string | null;
  pickupTime: string;
  pickupPerson: string;
  pickupPhone: string;
  shootCallTime: string;
  shootLocation: string;
  sectionToken: string;
}

export interface DeptCalendarView {
  department: PRDepartment;
  entries: DeptCalendarEntry[];
}

export interface DeptCalendarTokenRow {
  department: PRDepartment;
  publicToken: string;
}

export interface MasterCalendarView {
  tokens: DeptCalendarTokenRow[];
  entries: DeptCalendarEntry[];
}

// --- Asset Studio dashboard summary ---

export interface AssetStudioSummary {
  templateCount: number;
  publishedTemplateCount: number;
  activeRunCount: number;
  variantsThisWeek: number;
  pendingApprovalCount: number;
  approvedCount: number;
  recentRuns: VariantRun[];
}
