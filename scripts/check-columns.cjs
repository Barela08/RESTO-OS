const { Client } = require('pg');
const { getDatabaseConfig } = require('./query-helper.cjs');

const client = new Client(getDatabaseConfig());

const targetTables = [
  'audit_logs', 'customer_otp_codes', 'customers', 'inventory_movements',
  'kitchen_stations', 'kitchen_ticket_items', 'login_rate_limits', 'loyalty_rewards',
  'loyalty_stamps', 'menu_item_addons', 'notification_delivery_logs', 'notifications',
  'order_item_addons', 'order_status_history', 'qr_generation_logs', 'qr_scan_logs',
  'recipe_ingredients', 'recipes', 'refunds', 'role_permissions',
  'staff_roles', 'suppliers', 'waiter_assignments'
];

async function run() {
  await client.connect();
  for (const t of targetTables) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position;
    `, [t]);
    console.log(`Table [${t}]: ${cols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', ')}`);
  }
  await client.end();
}

run().catch(console.error);
