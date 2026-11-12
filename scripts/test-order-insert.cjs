const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  'https://mklcrcyubohgfosgxmrm.supabase.co',
  'sb_publishable_7lji58Dx7rNxfkuAi4Diew_RZk-8Yn6',
  { realtime: { transport: ws } }
);

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function run() {
  console.log('Testing full order creation in Supabase...');

  // 1. Get an active table session (Table 5)
  const sessionRes = await supabase.rpc('verify_table_qr_token', {
    p_token_hash: '1e06f189a9d476549e1b232fe9b14f7730ce6861f801fa5657bf71e777e5bacb'
  });
  console.log('Session RPC result:', sessionRes.data?.session_id);
  const sessionId = sessionRes.data?.session_id;
  const tableId = sessionRes.data?.table_id;

  // 2. Get a menu item
  const { data: items } = await supabase.from('menu_items').select('*').limit(2);
  console.log('Found menu items:', items.map(i => i.name));

  // 3. Insert order
  const orderId = generateUUID();
  const orderNumber = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
  const subtotal = Number(items[0].base_price) + Number(items[1].base_price);
  const cgst = subtotal * 0.025;
  const sgst = subtotal * 0.025;
  const total = subtotal + cgst + sgst;

  const { data: orderData, error: orderErr } = await supabase.from('orders').insert({
    id: orderId,
    restaurant_id: 'rest-001-main',
    order_number: orderNumber,
    table_id: tableId,
    table_session_id: sessionId,
    waiter_id: 'a0000001-0000-0000-0000-000000000003',
    customer_name: 'Test Customer',
    customer_phone: '+91 98888 77665',
    subtotal_amount: subtotal,
    cgst_amount: cgst,
    sgst_amount: sgst,
    service_charge_amount: 0,
    discount_amount: 0,
    total_amount: total,
    status: 'PLACED',
    special_notes: 'Extra spicy, please',
  }).select();

  if (orderErr) {
    console.error('Order insert error:', orderErr);
    process.exit(1);
  }
  console.log('Order inserted successfully:', orderData[0].id, orderData[0].order_number);

  // 4. Insert order items
  const orderItems = items.map((item, idx) => ({
    id: generateUUID(),
    order_id: orderId,
    menu_item_id: item.id,
    item_name: item.name,
    unit_price: Number(item.base_price),
    quantity: 1,
    total_price: Number(item.base_price),
    status: 'NEW',
    kitchen_station_id: item.kitchen_station_id,
  }));

  const { data: oiData, error: oiErr } = await supabase.from('order_items').insert(orderItems).select();
  if (oiErr) {
    console.error('Order items insert error:', oiErr);
    process.exit(1);
  }
  console.log('Order items inserted:', oiData.length);

  // 5. Insert kitchen ticket
  const ticketId = generateUUID();
  const { data: tktData, error: tktErr } = await supabase.from('kitchen_tickets').insert({
    id: ticketId,
    restaurant_id: 'rest-001-main',
    order_id: orderId,
    station_id: items[0].kitchen_station_id,
    ticket_number: 'TKT-' + orderNumber + '-1',
    status: 'NEW',
    table_number: 'T-05',
  }).select();

  if (tktErr) {
    console.error('Kitchen ticket insert error:', tktErr);
    process.exit(1);
  }
  console.log('Kitchen ticket inserted:', tktData[0].id, tktData[0].ticket_number);

  // Clean up test order
  console.log('Cleaning up test order...');
  await supabase.from('orders').delete().eq('id', orderId);
  console.log('Test order cleaned up cleanly.');
  process.exit(0);
}

run().catch(console.error);
