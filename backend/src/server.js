import express from "express";
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';

// --- BAGONG IMPORTS PARA SA PATH AT ES MODULES ---
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const app = express();

// --- SETUP PARA SA __dirname SA ES MODULES ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors({
    // DINAGDAG NATIN YUNG RENDER LINK MO DITO PARA SAFE
    origin: ['http://localhost:5173', 'http://localhost:5174', 'https://wooden-bizzare-management-system.onrender.com'], 
    credentials: true,               
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy", 
    "default-src 'self'; " +
    "connect-src 'self'; " +
    // FIX: Idinagdag ang https://cdnjs.cloudflare.com sa style-src
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
    // FIX: Idinagdag ang https://cdnjs.cloudflare.com sa font-src para sa mismong icons
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: https:; " + 
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com;"
  );
  next();
});

// JSON Limit para sa profile picture
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Session
app.use(session({
    secret: process.env.SECRET_KEY || 'default_secret_key', 
    resave: false,
    saveUninitialized: false, 
    proxy: true, 
    cookie: {
        // FIX: Gagawing true kung nasa Render (HTTPS), false kung local lang
        secure: process.env.NODE_ENV === 'production',     
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
import profitRoutes from './routes/profitRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import productivityRoutes from './routes/productivityRoutes.js';

// API Routes (Dapat nauuna ang mga ito kaysa sa React static files)
app.use('/', userRoutes);
app.use('/api/projects', projectRoutes); 
app.use('/api', jobOrderRoutes);
app.use('/api/productivity', productivityRoutes);
app.use('/api/notifications', adminNotifRoutes);
app.use('/api/dashboard', adminDashboardRoutes);
app.use('/api/profit', profitRoutes);
app.use('/api/attendance', attendanceRoutes);

// Workers endpoint
import { getWorkersList } from './controllers/jobOrderController.js';
app.get('/api/workers', getWorkersList);


// =======================================================================
// --- BAGONG CODE PARA SA FRONTEND DEPLOYMENT (OPTION A) ---
// =======================================================================

app.use(express.static(path.join(__dirname, 'dist')));

// 2. CATCH-ALL ROUTE (NA-FIX NA ANG ERROR DITO): 
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// =======================================================================

const port = process.env.PORT || 8080; 
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
