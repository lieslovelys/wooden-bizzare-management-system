import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.SQL_USER,
  host: process.env.SQL_HOST,
  database: process.env.SQL_DB,
  password: process.env.SQL_PASS,
  port: process.env.SQL_PORT,
  
  // Kung local (localhost / 127.0.0.1), i-disable ang SSL. 
  // Kung live/Neon, gagamitin nito ang { rejectUnauthorized: false }
  ssl: process.env.SQL_HOST === 'localhost' || process.env.SQL_HOST === '127.0.0.1' 
    ? false 
    : { rejectUnauthorized: false }
});


const testPoolConnection = async() => {
  let client;
  try {
    client = await pool.connect();
    console.log('Database connection pool acquired a client successfully!');

    // Execute a test query
    const res = await client.query('SELECT 1 AS "result"');
    console.log('Test query (SELECT 1) executed successfully. Result:', res.rows[0].result);

    return true; // Connection successful
  } 
  catch (err) {
    console.error('Error connecting to the database or running the test query:', err.message);
    return false; // Connection failed
  } 
  finally {
    if (client) {
      client.release();
      console.log('Client released back to the pool.');
    }
  }
}

testPoolConnection();

export const query = (query, params) => pool.query(query, params);
export const getClient = () => pool.connect();
