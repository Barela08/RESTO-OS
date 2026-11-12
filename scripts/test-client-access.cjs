const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  'https://mklcrcyubohgfosgxmrm.supabase.co',
  'sb_publishable_7lji58Dx7rNxfkuAi4Diew_RZk-8Yn6',
  {
    realtime: {
      transport: ws
    }
  }
);

async function test() {
  console.log('Testing anon access to tables...');
  
  const tables = await supabase.from('restaurant_tables').select('*');
  console.log('restaurant_tables:', tables.error ? tables.error.message : `${tables.data.length} tables found`);

  const qrs = await supabase.from('table_qr_tokens').select('*');
  console.log('table_qr_tokens:', qrs.error ? qrs.error.message : `${qrs.data.length} tokens found`);

  const menu = await supabase.from('menu_items').select('*');
  console.log('menu_items:', menu.error ? menu.error.message : `${menu.data.length} items found`);

  const staff = await supabase.from('staff').select('*');
  console.log('staff:', staff.error ? staff.error.message : `${staff.data.length} staff found`);

  // Test verify_table_qr_token RPC
  const rpcRes = await supabase.rpc('verify_table_qr_token', {
    p_token_hash: '1e06f189a9d476549e1b232fe9b14f7730ce6861f801fa5657bf71e777e5bacb'
  });
  console.log('verify_table_qr_token RPC result:', rpcRes.error ? rpcRes.error.message : rpcRes.data);
}

test().catch(console.error);
