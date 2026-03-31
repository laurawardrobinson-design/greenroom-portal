-- Add props-specific categories to gear_category enum
-- (gear_items table is shared between Gear and Props sections)
ALTER TYPE gear_category ADD VALUE IF NOT EXISTS 'Surfaces & Backgrounds';
ALTER TYPE gear_category ADD VALUE IF NOT EXISTS 'Tableware';
ALTER TYPE gear_category ADD VALUE IF NOT EXISTS 'Linens & Textiles';
ALTER TYPE gear_category ADD VALUE IF NOT EXISTS 'Cookware & Small Wares';
ALTER TYPE gear_category ADD VALUE IF NOT EXISTS 'Decorative Items';
ALTER TYPE gear_category ADD VALUE IF NOT EXISTS 'Furniture';
