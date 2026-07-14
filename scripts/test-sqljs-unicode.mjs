import initSqlJs from 'sql.js';

const SQL = await initSqlJs();
const db = new SQL.Database();

db.run('CREATE TABLE test (id TEXT, title TEXT)');
db.run('INSERT INTO test (id, title) VALUES (?, ?)', ['t1', '泛型所有权学习Rust']);

const stmt = db.prepare('SELECT id, title, hex(title) as th FROM test');
while (stmt.step()) {
  const r = stmt.getAsObject();
  const expected = Buffer.from('泛型所有权学习Rust', 'utf8').toString('hex');
  console.log('title:', r.title);
  console.log('hex:', r.th);
  console.log('expected:', expected);
  console.log('match:', r.th === expected);
}
stmt.free();

// Also test via our provider API
const stmt2 = db.prepare('SELECT title FROM test WHERE title LIKE ?');
stmt2.bind(['%泛型%']);
console.log('LIKE 泛型 found:', stmt2.step());
stmt2.free();

db.close();
