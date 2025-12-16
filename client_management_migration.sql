-- ============================================
-- Client Management and Authentication Migration
-- ============================================
-- This migration adds support for:
-- 1. Multiple contact persons per client
-- 2. Many-to-many relationship between campaigns and clients
-- 3. Email-based authentication for Client Portal
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 1: Create contacts table
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint on email (globally unique)
ALTER TABLE contacts ADD CONSTRAINT contacts_email_unique UNIQUE (email);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_client_id ON contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- Add comments
COMMENT ON TABLE contacts IS 'Contact persons for each client. Each client can have multiple contacts.';
COMMENT ON COLUMN contacts.email IS 'Email address used for Client Portal authentication.';

-- ============================================
-- STEP 2: Create campaign_clients junction table
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT campaign_clients_unique UNIQUE (campaign_id, client_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_clients_campaign ON campaign_clients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_clients_client ON campaign_clients(client_id);

-- Add comments
COMMENT ON TABLE campaign_clients IS 'Junction table for many-to-many relationship between campaigns and clients.';

-- ============================================
-- STEP 3: Drop old client_id column from campaigns (optional)
-- ============================================
-- NOTE: This step is destructive. Only run if you're sure you want to drop the old relationship.
-- If you have existing data, you may want to migrate it first.

-- First, migrate existing relationships to junction table (if any exist)
INSERT INTO campaign_clients (campaign_id, client_id)
SELECT id, client_id FROM campaigns 
WHERE client_id IS NOT NULL
ON CONFLICT (campaign_id, client_id) DO NOTHING;

-- Drop the old foreign key constraint
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_client_id_fkey;

-- Drop the old column
ALTER TABLE campaigns DROP COLUMN IF EXISTS client_id;

-- Drop the old index if it exists
DROP INDEX IF EXISTS idx_campaigns_client_id;

-- ============================================
-- STEP 4: Grant permissions
-- ============================================
-- Grant public access to new tables (same as existing tables)
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_clients DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE contacts TO public;
GRANT ALL ON TABLE campaign_clients TO public;

-- ============================================
-- STEP 5: Create helper views
-- ============================================

-- View to get campaign with all associated clients
CREATE OR REPLACE VIEW campaign_with_clients AS
SELECT 
    c.id as campaign_id,
    c.name as campaign_name,
    c.strategy_goals,
    c.created_at as campaign_created_at,
    cl.id as client_id,
    cl.name as client_name,
    cl.tone_of_voice,
    cl.strict_rules
FROM campaigns c
LEFT JOIN campaign_clients cc ON c.id = cc.campaign_id
LEFT JOIN clients cl ON cc.client_id = cl.id;

-- View to check if an email has access to a campaign
CREATE OR REPLACE VIEW campaign_email_access AS
SELECT DISTINCT
    co.email,
    cc.campaign_id,
    c.name as campaign_name,
    cl.id as client_id,
    cl.name as client_name,
    co.name as contact_name
FROM contacts co
JOIN clients cl ON co.client_id = cl.id
JOIN campaign_clients cc ON cl.id = cc.client_id
JOIN campaigns c ON cc.campaign_id = c.id;

GRANT SELECT ON campaign_with_clients TO public;
GRANT SELECT ON campaign_email_access TO public;

-- ============================================
-- VERIFICATION QUERIES (run manually to verify)
-- ============================================
-- SELECT * FROM contacts;
-- SELECT * FROM campaign_clients;
-- SELECT * FROM campaign_with_clients;
-- SELECT * FROM campaign_email_access WHERE email = 'test@example.com';

