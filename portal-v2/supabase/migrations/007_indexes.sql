-- ============================================================
-- Migration 007: Indexes for query performance
-- ============================================================

-- Campaigns
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_budget_pool ON campaigns(budget_pool_id);
CREATE INDEX idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX idx_campaigns_wf_number ON campaigns(wf_number);

-- Shoot Days
CREATE INDEX idx_shoot_days_campaign ON shoot_days(campaign_id);
CREATE INDEX idx_shoot_days_date ON shoot_days(shoot_date);

-- Campaign Deliverables
CREATE INDEX idx_deliverables_campaign ON campaign_deliverables(campaign_id);

-- Campaign Crew
CREATE INDEX idx_crew_campaign ON campaign_crew(campaign_id);
CREATE INDEX idx_crew_user ON campaign_crew(user_id);

-- Campaign Assets
CREATE INDEX idx_assets_campaign ON campaign_assets(campaign_id);
CREATE INDEX idx_assets_category ON campaign_assets(category);

-- Campaign Vendors
CREATE INDEX idx_cv_campaign ON campaign_vendors(campaign_id);
CREATE INDEX idx_cv_vendor ON campaign_vendors(vendor_id);
CREATE INDEX idx_cv_status ON campaign_vendors(status);

-- Vendor Estimate Items
CREATE INDEX idx_estimate_items_cv ON vendor_estimate_items(campaign_vendor_id);

-- Vendor Invoices
CREATE INDEX idx_invoices_cv ON vendor_invoices(campaign_vendor_id);
CREATE INDEX idx_invoices_parse_status ON vendor_invoices(parse_status);

-- Vendor Invoice Items
CREATE INDEX idx_invoice_items_invoice ON vendor_invoice_items(invoice_id);

-- Budget Requests
CREATE INDEX idx_budget_requests_campaign ON budget_requests(campaign_id);
CREATE INDEX idx_budget_requests_status ON budget_requests(status);

-- Gear Items
CREATE INDEX idx_gear_items_category ON gear_items(category);
CREATE INDEX idx_gear_items_status ON gear_items(status);
CREATE INDEX idx_gear_items_qr ON gear_items(qr_code);

-- Gear Checkouts
CREATE INDEX idx_gear_checkouts_item ON gear_checkouts(gear_item_id);
CREATE INDEX idx_gear_checkouts_user ON gear_checkouts(user_id);
CREATE INDEX idx_gear_checkouts_open ON gear_checkouts(gear_item_id) WHERE checked_in_at IS NULL;

-- Gear Reservations
CREATE INDEX idx_gear_reservations_item ON gear_reservations(gear_item_id);
CREATE INDEX idx_gear_reservations_dates ON gear_reservations(start_date, end_date);
CREATE INDEX idx_gear_reservations_user ON gear_reservations(user_id);

-- Gear Maintenance
CREATE INDEX idx_gear_maintenance_item ON gear_maintenance(gear_item_id);
CREATE INDEX idx_gear_maintenance_status ON gear_maintenance(status);
CREATE INDEX idx_gear_maintenance_next_due ON gear_maintenance(next_due_date);
