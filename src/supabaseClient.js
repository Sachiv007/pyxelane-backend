import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kuypxackmbyiaoxqvxka.supabase.co';   
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eXB4YWNrbWJ5aWFveHF2eGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NTg0MDYsImV4cCI6MjA3MjEzNDQwNn0.nMJRWhA8iIhRdePoDZb1BPOnP6E8ucezxh_Vp_5pWMU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey);