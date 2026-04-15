const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const sqlite3 = require('sqlite3').verbose()

const app = express()
app.use(cors())
app.use(bodyParser.json())

// DB
const db = new sqlite3.Database('./military.db')

// Create Tables + Insert Default Data
db.serialize(() => {
  // USERS TABLE
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    )
  `)

  // ASSETS TABLE
  db.run(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      type TEXT,
      quantity INTEGER,
      base TEXT,
      assignedTo TEXT
    )
  `)

  // 🔥 AUTO INSERT USERS (IMPORTANT)
  db.run(`
    INSERT OR IGNORE INTO users (username, password, role)
    VALUES 
    ('admin','123','admin'),
    ('commander','123','commander'),
    ('logistics','123','logistics')
  `)
})

//
// 🔐 RBAC Middleware
//
const auth = (roles) => {
  return (req, res, next) => {
    const role = req.headers.role

    if (!roles.includes(role)) {
      return res.status(403).json({ message: 'Access Denied' })
    }
    next()
  }
}

//
// 🔑 LOGIN
//
app.post('/api/login', (req, res) => {
  const { username, password } = req.body

  db.get(
    `SELECT * FROM users WHERE username=? AND password=?`,
    [username, password],
    (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Server error' })
      }
      if (user) {
        res.json(user)
      } else {
        res.status(400).json({ message: 'Invalid credentials' })
      }
    }
  )
})

//
// 👤 CREATE USER
//
app.post('/api/users', (req, res) => {
  const { username, password, role } = req.body

  db.run(
    `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
    [username, password, role],
    function (err) {
      if (err) {
        return res.status(400).json({ message: 'User already exists' })
      }
      res.json({ id: this.lastID })
    }
  )
})

//
// 📦 GET ASSETS
//
app.get('/api/assets', (req, res) => {
  db.all(`SELECT * FROM assets`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching assets' })
    }
    res.json(rows)
  })
})

//
// ➕ ADD ASSET (ADMIN ONLY)
//
app.post('/api/assets', auth(['admin']), (req, res) => {
  const { name, type, quantity, base } = req.body

  db.run(
    `INSERT INTO assets (name, type, quantity, base) VALUES (?, ?, ?, ?)`,
    [name, type, quantity, base],
    function (err) {
      if (err) {
        return res.status(500).json({ message: 'Error adding asset' })
      }
      res.json({ id: this.lastID })
    }
  )
})

//
// 🔁 TRANSFER ASSET
//
app.post('/api/transfers', auth(['admin', 'logistics']), (req, res) => {
  const { id, toBase } = req.body

  db.run(
    `UPDATE assets SET base=? WHERE id=?`,
    [toBase, id],
    function (err) {
      if (err) {
        return res.status(500).json({ message: 'Transfer failed' })
      }
      res.json({ message: 'Transferred successfully' })
    }
  )
})

//
// 👨‍✈️ ASSIGN ASSET
//
app.post('/api/assignments', auth(['admin', 'commander']), (req, res) => {
  const { id, assignedTo } = req.body

  db.run(
    `UPDATE assets SET assignedTo=? WHERE id=?`,
    [assignedTo, id],
    function (err) {
      if (err) {
        return res.status(500).json({ message: 'Assignment failed' })
      }
      res.json({ message: 'Assigned successfully' })
    }
  )
})

//
// 🚀 START SERVER
//
const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})