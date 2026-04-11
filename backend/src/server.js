import express from "express";
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

// Middlewares
app.use(cors({
    origin: 'http://localhost:5173', 
    credentials: true,               
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
    saveUninitialized: false, 
    proxy: true, 
    cookie: {
        secure: false,     
        httpOnly: true,    
        sameSite: 'lax',   
        maxAge: 1000 * 60 * 60 
    }
}));


// Import Routers
import userRoutes from './routes/userRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import jobOrderRoutes from './routes/jobOrderRoutes.js';
import adminNotifRoutes from './routes/adminNotifRoutes.js';
import adminDashboardRoutes from './routes/adminDashboardRoutes.js';

// Routes
app.use('/', userRoutes);
app.use('/api/projects', projectRoutes); 
app.use('/api', jobOrderRoutes);
app.use('/api/notifications', adminNotifRoutes);
app.use('/api/dashboard', adminDashboardRoutes);


const url = 'http://localhost:';
const port = '8080';
app.listen(port, () => {
    console.log(`Server running on ${url}${port}`);
});