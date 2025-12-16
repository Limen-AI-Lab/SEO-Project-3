/**
 * Client Service - Handles client and contact CRUD operations
 */

import supabase from './supabaseClient.js';
import { Client, Contact } from '../types';

/**
 * Fetch all clients with their contacts
 */
export async function getAllClientsWithContacts(): Promise<Client[]> {
  try {
    // Fetch all clients
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      throw new Error(clientsError.message);
    }

    if (!clientsData || clientsData.length === 0) {
      return [];
    }

    // Fetch all contacts
    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: true });

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
      // Continue without contacts if there's an error (contacts table might not exist yet)
    }

    // Map clients with their contacts
    const mappedClients: Client[] = clientsData.map((client: any) => {
      const clientContacts = (contactsData || [])
        .filter((c: any) => c.client_id === client.id)
        .map((c: any) => ({
          id: c.id,
          client_id: c.client_id,
          name: c.name,
          email: c.email,
          created_at: c.created_at
        }));

      return {
        id: client.id,
        name: client.name,
        defaultTone: client.tone_of_voice || undefined,
        defaultRules: client.strict_rules || undefined,
        contacts: clientContacts
      };
    });

    return mappedClients;
  } catch (err) {
    console.error('Error in getAllClientsWithContacts:', err);
    throw err;
  }
}

/**
 * Fetch a single client with contacts
 */
export async function getClientWithContacts(clientId: string): Promise<Client | null> {
  try {
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError) {
      console.error('Error fetching client:', clientError);
      return null;
    }

    // Fetch contacts for this client
    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
      // Continue without contacts
    }

    const contacts: Contact[] = (contactsData || []).map((c: any) => ({
      id: c.id,
      client_id: c.client_id,
      name: c.name,
      email: c.email,
      created_at: c.created_at
    }));

    return {
      id: clientData.id,
      name: clientData.name,
      defaultTone: clientData.tone_of_voice || undefined,
      defaultRules: clientData.strict_rules || undefined,
      contacts
    };
  } catch (err) {
    console.error('Error in getClientWithContacts:', err);
    return null;
  }
}

/**
 * Create a new contact person for a client
 */
export async function createContact(clientId: string, name: string, email: string): Promise<Contact | null> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        client_id: clientId,
        name: name.trim(),
        email: email.trim().toLowerCase()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating contact:', error);
      // Check for unique constraint violation
      if (error.code === '23505') {
        throw new Error('This email address is already in use by another contact.');
      }
      throw new Error(error.message);
    }

    return {
      id: data.id,
      client_id: data.client_id,
      name: data.name,
      email: data.email,
      created_at: data.created_at
    };
  } catch (err) {
    console.error('Error in createContact:', err);
    throw err;
  }
}

/**
 * Update an existing contact
 */
export async function updateContact(contactId: string, name: string, email: string): Promise<Contact | null> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .update({
        name: name.trim(),
        email: email.trim().toLowerCase()
      })
      .eq('id', contactId)
      .select()
      .single();

    if (error) {
      console.error('Error updating contact:', error);
      if (error.code === '23505') {
        throw new Error('This email address is already in use by another contact.');
      }
      throw new Error(error.message);
    }

    return {
      id: data.id,
      client_id: data.client_id,
      name: data.name,
      email: data.email,
      created_at: data.created_at
    };
  } catch (err) {
    console.error('Error in updateContact:', err);
    throw err;
  }
}

/**
 * Delete a contact person
 */
export async function deleteContact(contactId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId);

    if (error) {
      console.error('Error deleting contact:', error);
      throw new Error(error.message);
    }

    return true;
  } catch (err) {
    console.error('Error in deleteContact:', err);
    throw err;
  }
}

/**
 * Get all contacts for a specific client
 */
export async function getContactsByClient(clientId: string): Promise<Contact[]> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching contacts:', error);
      return [];
    }

    return (data || []).map((c: any) => ({
      id: c.id,
      client_id: c.client_id,
      name: c.name,
      email: c.email,
      created_at: c.created_at
    }));
  } catch (err) {
    console.error('Error in getContactsByClient:', err);
    return [];
  }
}

/**
 * Check if an email exists in the contacts table
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking email:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('Error in checkEmailExists:', err);
    return false;
  }
}

