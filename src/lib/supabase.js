import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://niexjensniqqfekfhwow.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pZXhqZW5zbmlxcWZla2Zod293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTIxMzEsImV4cCI6MjA5MTEyODEzMX0.FhYReCAKugWDOW4tJkY0Hc4Y1vHKB7fHm5-fFEH4ivg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
