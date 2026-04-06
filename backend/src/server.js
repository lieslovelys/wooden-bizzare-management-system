import express from "express";
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

// Middlewares
app.use(cors({
    origin: 'http://localhost:5173', // Change this to your EXACT frontend URL
    credentials: true,               // Required for cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'self' http://localhost:8080;");
  next();
});

app.use(express.json());

// Session
app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false, // Changed to false: don't create sessions for "ghost" requests
    proxy: true, // Trust the local connection
    cookie: {
        secure: false,     // MUST be false for HTTP localhost
        httpOnly: true,    // Good for security
        sameSite: 'lax',   // Required for cross-port cookies on Chrome
        maxAge: 1000 * 60 * 60 // 1 hour
    }

}));

// Import Routers
import userRoutes from './routes/userRoutes.js';
// Routes
app.use('/', userRoutes);

const url = 'http://localhost:';
const port = '8080';
app.listen(port, () => {
    console.log(`Server running on ${url}${port}`);
});