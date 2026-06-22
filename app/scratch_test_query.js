import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function test() {
  const { data, error } = await supabaseAdmin
    .from('okr_objectives')
    .select(`
      *, 
      okr_key_results (
        *,
        okr_checkins (count)
      )
    `)
    .limit(1)
  console.log(JSON.stringify({data, error}, null, 2))
}
test()
