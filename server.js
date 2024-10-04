require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Use environment variables for sensitive data
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Initialize PostgreSQL connection using DATABASE_URL
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the favicon
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// Nodemailer transport setup
const transporter = nodemailer.createTransport({
  service: 'gmail', // Using Gmail as the email service
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Verify JWT Token
function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'No token provided' });

  jwt.verify(token.split(' ')[1], JWT_SECRET, (err, decoded) => {
    if (err) return res.status(500).json({ error: 'Failed to authenticate token' });

    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  });
}

// Check if User is Admin
function isAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'You are not authorized to perform this action' });
  }
  next();
}

// User Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const passwordIsValid = await bcrypt.compare(password, user.password);

    if (!passwordIsValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: 86400, // 24 hours
    });

    res.status(200).json({ auth: true, token: token, role: user.role });
  } catch (error) {
    console.error('Error logging in user:', error.message);
    res.status(500).json({ error: 'Failed to login', details: error.message });
  }
});

// User Registration
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, email, hashedPassword, 'user']
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    console.error('Error registering user:', error.message);
    res.status(500).json({ error: 'Failed to register user', details: error.message });
  }
});

// Get Time Entries
app.get('/api/timeentries', verifyToken, async (req, res) => {
  try {
    let query = `
      SELECT te.*, p.name as project_name, u.username
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN users u ON te.user_id = u.id
    `;
    let params = [];

    if (req.userRole !== 'admin') {
      query += ' WHERE te.user_id = $1';
      params.push(req.userId);
    }

    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching time entries:', error.message);
    res.status(500).json({ error: 'Failed to fetch time entries', details: error.message });
  }
});

// Add Project
app.post('/api/projects', verifyToken, isAdmin, async (req, res) => {
  const { name, number, client, street, city } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO projects (name, number, client, street, city) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, number, client, street, city]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    console.error('Error adding project:', error.message);
    res.status(500).json({ error: 'Failed to add project', details: error.message });
  }
});

// Update Project
app.put('/api/projects/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, number, client, street, city } = req.body;
  try {
    await pool.query(
      'UPDATE projects SET name = $1, number = $2, client = $3, street = $4, city = $5 WHERE id = $6',
      [name, number, client, street, city, id]
    );
    res.status(200).json({ message: 'Project updated successfully' });
  } catch (error) {
    console.error('Error updating project:', error.message);
    res.status(500).json({ error: 'Failed to update project', details: error.message });
  }
});

// Delete Project
app.delete('/api/projects/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error.message);
    res.status(500).json({ error: 'Failed to delete project', details: error.message });
  }
});

// Update User
app.put('/api/user/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { username, email, password, role } = req.body;

  try {
    let updateQuery = 'UPDATE users SET username = $1, email = $2, role = $3 WHERE id = $4';
    const params = [username, email, role, id];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery = 'UPDATE users SET username = $1, email = $2, password = $3, role = $4 WHERE id = $5';
      params.splice(2, 0, hashedPassword);
    }

    await pool.query(updateQuery, params);
    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error.message);
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
});

// Delete User
app.delete('/api/user/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error.message);
    res.status(500).json({ error: 'Failed to delete user', details: error.message });
  }
});

// Get Projects
app.get('/api/projects', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error.message);
    res.status(500).json({ error: 'Failed to fetch projects', details: error.message });
  }
});

// Get Users
app.get('/api/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role FROM users');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

// Dashboard Data
app.get('/api/dashboard', verifyToken, async (req, res) => {
  const { startDate, endDate, project_id, client, user_id } = req.query;

  let query = `
    SELECT 
      COALESCE(SUM(EXTRACT(EPOCH FROM te.duration) / 3600), 0) as totalHours, 
      COUNT(DISTINCT te.project_id) as projectsInProgress, 
      COALESCE(MAX(p.client), 'None') as topClient 
    FROM time_entries te
    LEFT JOIN projects p ON te.project_id = p.id
    WHERE te.user_id = $1
  `;
  const params = [req.userId];

  if (startDate) {
    query += ` AND te.date >= $${params.length + 1}`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND te.date <= $${params.length + 1}`;
    params.push(endDate);
  }
  if (project_id) {
    query += ` AND te.project_id = $${params.length + 1}`;
    params.push(project_id);
  }
  if (client) {
    query += ` AND p.client = $${params.length + 1}`;
    params.push(client);
  }
  if (user_id) {
    query += ` AND te.user_id = $${params.length + 1}`;
    params.push(user_id);
  }

  try {
    const result = await pool.query(query, params);

    // Dodatkowe zapytanie o projekty, klientów i użytkowników
    const projects = await pool.query('SELECT id, name FROM projects');
    const clients = await pool.query('SELECT DISTINCT client FROM projects');
    const users = await pool.query('SELECT id, username FROM users');

    res.status(200).json({
      totalHours: result.rows[0]?.totalHours || 0,
      projectsInProgress: result.rows[0]?.projectsInProgress || 0,
      topClient: result.rows[0]?.topClient || 'None',
      projects: projects.rows,
      clients: clients.rows.map(client => ({ id: client.client, name: client.client })),
      users: users.rows // Zwróć użytkowników
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error.message);
    res.status(500).json({ error: 'Failed to fetch dashboard data', details: error.message });
  }
});

// Profile Update
app.put('/api/user/profile', verifyToken, async (req, res) => {
  const { username, email, password, avatar } = req.body;
  const { userId } = req;

  try {
    let updateQuery = 'UPDATE users SET username = $1, email = $2, avatar = $3 WHERE id = $4';
    const params = [username, email, avatar, userId];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery = 'UPDATE users SET username = $1, email = $2, password = $3, avatar = $4 WHERE id = $5';
      params.splice(2, 0, hashedPassword);
    }

    await pool.query(updateQuery, params);
    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error.message);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

// Email Notification Setup
async function sendNotificationEmail(userEmail) {
  const mailOptions = {
    from: EMAIL_USER,
    to: userEmail,
    subject: 'Weekly Time Entry Reminder',
    text: 'You have not logged any time entries this week. Please ensure to update your time log.'
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Notification email sent to:', userEmail);
  } catch (error) {
    console.error('Error sending notification email:', error);
  }
}

// Weekly Notification Cron Job
setInterval(async () => {
  try {
    const users = await pool.query(`
      SELECT email FROM users WHERE NOT EXISTS (
        SELECT 1 FROM time_entries WHERE user_id = users.id AND date >= CURRENT_DATE - INTERVAL '7 days'
      )
    `);

    for (let user of users.rows) {
      await sendNotificationEmail(user.email);
    }
  } catch (error) {
    console.error('Error fetching users for notification:', error);
  }
}, 604800000); // 604800000 ms = 1 week

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
