// ============================================================
// Domain Types — the language of the production portal
// ============================================================

// --- Roles ---
export type UserRole = "Admin" | "Producer" | "Studio" | "Vendor" | "Art Director";

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
  artDirectorId: string | null;
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
  conditionOut: GearCondition;
  conditionIn: GearCondition | null;
  notes: string;
  gearItem?: GearItem;
  user?: AppUser;
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
  deliverableLinks: ShotDeliverableLink[];
  productLinks: ShotProductLink[];
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
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignProduct {
  id: string;
  campaignId: string;
  productId: string;
  notes: string;
  sortOrder: number;
  product?: Product;
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

// --- Call Sheet (computed, not stored) ---
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
