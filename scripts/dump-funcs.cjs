const { executeSql } = require('./query-helper.cjs');

async function dumpFuncs() {
  const funcs = [
    'generate_permanent_table_qr', 'generate_daily_qr_tokens',
    'server_calculate_order_totals', 'get_table_daily_collection_summary',
    'settle_table_bill_and_close_session', 'mark_table_cleaned',
    'confirm_cash_payment', 'verify_table_qr_token'
  ];
  for (const f of funcs) {
    try {
      const res = await executeSql(`SELECT pg_get_functiondef('${f}'::regproc)`);
      console.log(`\n=================== FUNCTION ${f} ===================`);
      console.log(res.rows[0].pg_get_functiondef);
    } catch (e) {
      console.error(`Error dumping ${f}:`, e.message);
    }
  }
}

dumpFuncs();
