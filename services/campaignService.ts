/**
 * Campaign Service - Handles campaign operations with multi-client support
 */

import supabase from './supabaseClient.js';
import { Campaign, Client, Contact } from '../types';

/**
 * Create a new campaign with multiple associated clients
 */
export async function createCampaignWithClients(
  campaignData: { name: string; strategyGoals?: string; targetAudience?: string; keywords?: string[]; cmsId?: string },
  clientIds: string[]
): Promise<Campaign | null> {
  try {
    // First create the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        name: campaignData.name,
        strategy_goals: campaignData.strategyGoals || null,
        cms_id: campaignData.cmsId || null
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Error creating campaign:', campaignError);
      throw new Error(campaignError.message);
    }

    // Then create the campaign_clients associations
    if (clientIds.length > 0) {
      const associations = clientIds.map(clientId => ({
        campaign_id: campaign.id,
        client_id: clientId
      }));

      const { error: assocError } = await supabase
        .from('campaign_clients')
        .insert(associations);

      if (assocError) {
        console.error('Error creating campaign-client associations:', assocError);
        // Campaign was created but associations failed - try to clean up
        await supabase.from('campaigns').delete().eq('id', campaign.id);
        throw new Error('Failed to associate clients with campaign: ' + assocError.message);
      }
    }

    // Return the created campaign
    return {
      id: campaign.id,
      name: campaign.name,
      strategyGoals: campaign.strategy_goals || '',
      targetAudience: campaignData.targetAudience || '',
      keywords: campaignData.keywords || [],
      createdAt: new Date(campaign.created_at),
      status: 'ACTIVE',
      cmsId: campaign.cms_id
    };
  } catch (err) {
    console.error('Error in createCampaignWithClients:', err);
    throw err;
  }
}

/**
 * Update an existing campaign
 */
export async function updateCampaign(
  campaignId: string,
  updates: Partial<Campaign>
): Promise<Campaign | null> {
  try {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.strategyGoals !== undefined) dbUpdates.strategy_goals = updates.strategyGoals;
    if (updates.cmsId !== undefined) dbUpdates.cms_id = updates.cmsId;
    
    // Only proceed if there are fields to update
    if (Object.keys(dbUpdates).length === 0) return null;

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update(dbUpdates)
      .eq('id', campaignId)
      .select()
      .single();

    if (error) {
      console.error('Error updating campaign:', error);
      throw new Error(error.message);
    }

    // We need to return the full campaign object, so we might need to fetch associated data
    // For now, let's return a basic merged object or fetch fresh
    return getCampaignWithClients(campaignId);
  } catch (err) {
    console.error('Error in updateCampaign:', err);
    throw err;
  }
}

/**
 * Get campaign with all associated clients
 */
export async function getCampaignWithClients(campaignId: string): Promise<Campaign | null> {
  try {
    // Fetch campaign
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError) {
      console.error('Error fetching campaign:', campaignError);
      return null;
    }

    // Fetch associated clients through junction table
    const { data: associations, error: assocError } = await supabase
      .from('campaign_clients')
      .select('client_id, clients(*)')
      .eq('campaign_id', campaignId);

    if (assocError) {
      console.error('Error fetching campaign clients:', assocError);
      // Continue without clients
    }

    // Map clients
    const clients: Client[] = (associations || [])
      .filter((a: any) => a.clients)
      .map((a: any) => ({
        id: a.clients.id,
        name: a.clients.name,
        defaultTone: a.clients.tone_of_voice || undefined,
        defaultRules: a.clients.strict_rules || undefined
      }));

    // Build client names string for backward compatibility
    const clientName = clients.map(c => c.name).join(', ') || '';

    return {
      id: campaignData.id,
      name: campaignData.name,
      clientName,
      clients,
      strategyGoals: campaignData.strategy_goals || '',
      targetAudience: '',
      keywords: [],
      createdAt: new Date(campaignData.created_at),
      status: 'ACTIVE',
      cmsId: campaignData.cms_id
    };
  } catch (err) {
    console.error('Error in getCampaignWithClients:', err);
    return null;
  }
}

/**
 * Get all campaigns with their associated clients
 */
export async function getAllCampaignsWithClients(): Promise<Campaign[]> {
  try {
    // Fetch all campaigns
    const { data: campaignsData, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError);
      throw new Error(campaignsError.message);
    }

    if (!campaignsData || campaignsData.length === 0) {
      return [];
    }

    // Fetch all campaign_clients associations
    const { data: allAssociations, error: assocError } = await supabase
      .from('campaign_clients')
      .select('campaign_id, client_id, clients(*)');

    if (assocError) {
      console.error('Error fetching campaign-client associations:', assocError);
      // Continue without client info
    }

    // Map campaigns with their clients
    return campaignsData.map((camp: any) => {
      const associations = (allAssociations || []).filter((a: any) => a.campaign_id === camp.id);
      const clients: Client[] = associations
        .filter((a: any) => a.clients)
        .map((a: any) => ({
          id: a.clients.id,
          name: a.clients.name,
          defaultTone: a.clients.tone_of_voice || undefined,
          defaultRules: a.clients.strict_rules || undefined
        }));

      const clientName = clients.map(c => c.name).join(', ') || '';

      return {
        id: camp.id,
        name: camp.name,
        clientName,
        clients,
        strategyGoals: camp.strategy_goals || '',
        targetAudience: '',
        keywords: [],
        createdAt: new Date(camp.created_at),
        status: 'ACTIVE' as const,
        cmsId: camp.cms_id
      };
    });
  } catch (err) {
    console.error('Error in getAllCampaignsWithClients:', err);
    throw err;
  }
}

/**
 * Add a client to an existing campaign
 */
export async function addClientToCampaign(campaignId: string, clientId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('campaign_clients')
      .insert({
        campaign_id: campaignId,
        client_id: clientId
      });

    if (error) {
      // Check for duplicate constraint violation
      if (error.code === '23505') {
        console.log('Client is already associated with this campaign');
        return true; // Not an error, client is already associated
      }
      console.error('Error adding client to campaign:', error);
      throw new Error(error.message);
    }

    return true;
  } catch (err) {
    console.error('Error in addClientToCampaign:', err);
    throw err;
  }
}

/**
 * Remove a client from an existing campaign
 */
export async function removeClientFromCampaign(campaignId: string, clientId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('campaign_clients')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('client_id', clientId);

    if (error) {
      console.error('Error removing client from campaign:', error);
      throw new Error(error.message);
    }

    return true;
  } catch (err) {
    console.error('Error in removeClientFromCampaign:', err);
    throw err;
  }
}

/**
 * Get all clients associated with a campaign
 */
export async function getCampaignClients(campaignId: string): Promise<Client[]> {
  try {
    const { data, error } = await supabase
      .from('campaign_clients')
      .select('clients(*)')
      .eq('campaign_id', campaignId);

    if (error) {
      console.error('Error fetching campaign clients:', error);
      return [];
    }

    return (data || [])
      .filter((row: any) => row.clients)
      .map((row: any) => ({
        id: row.clients.id,
        name: row.clients.name,
        defaultTone: row.clients.tone_of_voice || undefined,
        defaultRules: row.clients.strict_rules || undefined
      }));
  } catch (err) {
    console.error('Error in getCampaignClients:', err);
    return [];
  }
}

/**
 * Get all contact emails for a campaign (for authentication purposes)
 */
export async function getCampaignContactEmails(campaignId: string): Promise<string[]> {
  try {
    // Get client IDs associated with the campaign
    const { data: associations, error: assocError } = await supabase
      .from('campaign_clients')
      .select('client_id')
      .eq('campaign_id', campaignId);

    if (assocError || !associations || associations.length === 0) {
      return [];
    }

    const clientIds = associations.map((a: any) => a.client_id);

    // Get all contacts for these clients
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('email')
      .in('client_id', clientIds);

    if (contactsError || !contacts) {
      return [];
    }

    return contacts.map((c: any) => c.email);
  } catch (err) {
    console.error('Error in getCampaignContactEmails:', err);
    return [];
  }
}

/**
 * Verify if an email has access to a specific campaign
 */
export async function verifyEmailAccessToCampaign(email: string, campaignId: string): Promise<boolean> {
  try {
    // First, find the contact by email
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('client_id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (contactError || !contact) {
      return false;
    }

    // Check if the contact's client is associated with the campaign
    const { data: association, error: assocError } = await supabase
      .from('campaign_clients')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('client_id', contact.client_id)
      .single();

    if (assocError || !association) {
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in verifyEmailAccessToCampaign:', err);
    return false;
  }
}

