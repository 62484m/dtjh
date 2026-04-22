import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nvwbrxsqhknrfrjxxsvj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52d2JyeHNxaGtucmZyanh4c3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODE4MTAsImV4cCI6MjA5MjA1NzgxMH0.PZDUM1YsAhocV0-KHTqbFzyrS_UuSPbyF8FThIKlwMQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
