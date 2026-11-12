const { executeSql } = require('./query-helper.cjs');

const tables = ['waiter_calls', 'kitchen_tickets', 'payments', 'invoices', 'restaurant_tables', 'orders', 'order_items'];

async function run() {
  const res = await executeSql(`
    SELECT tablename, policyname, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = ANY($1)
    ORDER BY tablename, cmd, policyname
  `, [tables]);
  console.log(JSON.stringify(res.rows, null, 2));
}

run().catch(console.error);
