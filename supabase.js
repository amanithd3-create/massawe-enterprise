import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jxrttgsjmgitarssxrua.supabase.co'
const supabaseAnonKey = 'sb_publishable_CF6vxoAsw6zASf8J4DLD1g_cVRrbCOj'

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)
