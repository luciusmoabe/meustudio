const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const email = 'luciusmoabe@gmail.com';
  const password = 'Lmdm@3798';
  
  const { data: { users }, error: errUsers } = await supabase.auth.admin.listUsers();
  if (errUsers) {
    console.error("Error listing users:", errUsers);
    return;
  }
  
  const testUser = users.find(u => u.email === email);
  if (!testUser) {
    console.log("User not found!");
    return;
  }
  
  console.log("Updating password for user ID:", testUser.id);
  const { data, error } = await supabase.auth.admin.updateUserById(
    testUser.id,
    { password: password }
  );
  
  if (error) {
    console.error("Error updating password:", error);
  } else {
    console.log("Password updated successfully!");
  }
}

run();
