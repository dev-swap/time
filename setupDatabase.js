// File path: setupDatabase.js

require('dotenv').config();
const { Pool } = require('pg');

// Configure the PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const setupDatabase = async () => {
  const client = await pool.connect();
  try {
    // Start a transaction
    await client.query('BEGIN');

    // Drop existing tables if they exist
    await client.query('DROP TABLE IF EXISTS time_entries CASCADE');
    await client.query('DROP TABLE IF EXISTS projects CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');

    // Create the users table
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'admin'))
      )
    `);

    // Create the projects table
    await client.query(`
      CREATE TABLE projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        number VARCHAR(50) NOT NULL,
        client VARCHAR(100) NOT NULL,
        street VARCHAR(100) NOT NULL,
        city VARCHAR(100) NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create the time_entries table
    await client.query(`
      CREATE TABLE time_entries (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        start_time TIME NOT NULL,
        break_time INTERVAL DEFAULT '0 hours',
        duration INTERVAL NOT NULL,
        end_time TIME NOT NULL,
        notes TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Commit the transaction
    await client.query('COMMIT');
    console.log('Database setup complete: Tables created successfully');
  } catch (error) {
    // Rollback the transaction in case of error
    await client.query('ROLLBACK');
    console.error('Error setting up database:', error.message);
  } finally {
    // Release the client back to the pool
    client.release();
  }
};

// Run the setup function
setupDatabase().catch(error => console.error('Failed to setup database:', error.message));
