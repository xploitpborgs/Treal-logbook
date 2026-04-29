import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase
    .from('log_entries')
    .select('*, author:profiles!author_id(id, full_name, avatar_url, department)')
    .limit(1)
  
  console.log("Error:", error)
}
test()
