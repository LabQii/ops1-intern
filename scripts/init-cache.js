const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    envVars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('response_cache')
    .select('id')
    .limit(1);

  if (error) {
    console.error('❌', error.message);
  } else {
    console.log('✅ Table response_cache is accessible! Rows:', data.length);
  }
}

main().catch(console.error);
