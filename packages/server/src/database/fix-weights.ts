import pg from 'pg';
const pool = new pg.Pool({
  host: 'localhost', port: 5432, database: 'solvechain',
  user: 'postgres', password: '123456'
});

async function fix() {
  // 把 1.05 改成 1.0
  const r1 = await pool.query('UPDATE nodes SET weight = 1.0 WHERE weight > 1.04 AND weight < 1.06');
  const r2 = await pool.query('UPDATE edges SET strength = 1.0 WHERE strength > 1.04 AND strength < 1.06');
  console.log('更新节点:', r1.rowCount);
  console.log('更新边:', r2.rowCount);
  await pool.end();
}
fix();
