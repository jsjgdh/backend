'use strict'

require('dotenv').config()

const path = require('path')
const fs = require('fs')
const express = require('express')
const cors = require('cors')
const morgan = require('morgan')

// Import configuration
const connectDB = require('./config/database')
const seedUsers = require('./utils/seedUsers')

// Import routes
const authRoutes = require('./routes/auth.routes')
const staticRoutes = require('./routes/static.routes')
const transactionRoutes = require('./routes/transaction.routes')
const budgetRoutes = require('./routes/budget.routes')
const clientRoutes = require('./routes/client.routes')
const invoiceRoutes = require('./routes/invoice.routes')
const auditRoutes = require('./routes/audit.routes')
const exportRoutes = require('./routes/export.routes')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
// Support multiple CORS origins (production + development)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [
    'https://frontend-roan-pi-68.vercel.app',
    'http://localhost:5173'
  ]

// CORS configuration with explicit headers for preflight requests
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`)
      callback(new Error('Not allowed by CORS'), false)
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false, // Pass preflight response to next handler
  optionsSuccessStatus: 204 // Some legacy browsers choke on 204
}

app.use(cors(corsOptions))

// Explicit OPTIONS handler for all routes
app.options('*', cors(corsOptions))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('combined'))

// Setup directories
const uploadsDir = path.join(__dirname, '..', 'uploads')
const publicDir = path.join(__dirname, '..', 'public')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true })

// Static file serving
app.use('/uploads', express.static(uploadsDir))
app.use('/', express.static(publicDir))

  // Connect to database and seed users
  ; (async () => {
    try {
      await connectDB()
      await seedUsers()
    } catch (error) {
      console.error('Database initialization error:', error.message)
    }
  })()

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api', staticRoutes)
app.use('/api', transactionRoutes)
app.use('/api', budgetRoutes)
app.use('/api', clientRoutes)
app.use('/api', invoiceRoutes)
app.use('/api', auditRoutes)
app.use('/api/export', exportRoutes)

// Health check endpoint
app.get('/health', (req, res) => {
  const mongoose = require('mongoose')
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    cors_allowed_origins: allowedOrigins,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  })
})

// API health check (requires authentication)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API is operational',
    timestamp: new Date().toISOString()
  })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'internal_server_error' })
})

// Start server (for local development)
// For Vercel serverless, the app is exported and Vercel handles the server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

// Export for Vercel serverless
module.exports = app
