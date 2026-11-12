const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  'https://mklcrcyubohgfosgxmrm.supabase.co',
  'sb_publishable_7lji58Dx7rNxfkuAi4Diew_RZk-8Yn6',
  {
    realtime: { transport: ws }
  }
);

async function testRealtime() {
  console.log('Subscribing to realtime channel...');
  
  let received = false;

  await new Promise((resolve) => {
    const channel = supabase.channel('realtime-test-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls' },
        (payload) => {
          console.log('Realtime event received for waiter_calls:', payload.eventType, payload.new?.id);
          received = true;
          resolve();
        }
      )
      .subscribe(async (status) => {
        console.log('Realtime status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed. Waiting 1s before insert...');
          await new Promise(r => setTimeout(r, 1000));
          const { data, error } = await supabase.from('waiter_calls').insert({
            restaurant_id: 'rest-001-main',
            table_id: 'c0000001-0000-0000-0000-000000000005',
            table_session_id: 'de0e90b1-563e-444d-a77f-2b867a073bf4',
            request_type: 'CALL_WAITER',
            status: 'REQUESTED',
            notes: 'Test from node waiter call'
          }).select();
          console.log('Insert finished:', error ? error.message : data[0].id);
        }
      });

    setTimeout(() => {
      console.log('Timeout reached');
      resolve();
    }, 12000);
  });

  console.log('Test completed. Event received:', received);
  process.exit(0);
}

testRealtime().catch(console.error);
