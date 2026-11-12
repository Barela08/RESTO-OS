const { executeSql } = require('./query-helper.cjs');

const tables = ['waiter_calls', 'kitchen_tickets', 'payments', 'invoices', 'restaurant_tables', 'orders', 'order_items'];

async function inspect() {
  for (const t of tables) {
    const res = await executeSql(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [t]);
    console.log(`\n=== Table: ${t} ===`);
    res.rows.forEach(r => {
      console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable}, default: ${r.column_default})`);
    });
  }
}

inspect().catch(console.error);
