import { createClient } from '@supabase/supabase-js';

// Supabase Project URL
// Find this in: Supabase Dashboard > Project Settings > API > Project URL
const supabaseUrl = 'https://yrhmbiimqcujbfqmuwii.supabase.co';

// Supabase Anon Key
// Find this in: Supabase Dashboard > Project Settings > API > anon public key
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaG1iaWltcWN1amJmcW11d2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMzU5NjEsImV4cCI6MjA4MDkxMTk2MX0.hGsv2yLPkGnO-DefS6Bm3gvf9pmbqKqVQOTVdlwQUY0';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;

