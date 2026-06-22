const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: { users }, error: err } = await supabase.auth.admin.listUsers();
  console.log('Auth Users:', users?.map(u => ({ id: u.id, email: u.email })), 'Error:', err);
}

check();
