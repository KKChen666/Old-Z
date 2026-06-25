import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '119.45.182.166',
  port: parseInt(process.env.DB_PORT || '9274'),
  database: process.env.DB_NAME || 'oldz',
  user: process.env.DB_USER || 'oldz',
  password: process.env.DB_PASSWORD || 'e4APP7yLTiMAmcrF',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
