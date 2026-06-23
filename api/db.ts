import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: '119.45.182.166',
  port: 9274,
  database: 'oldz',
  user: 'oldz',
  password: 'e4APP7yLTiMAmcrF',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
