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
    // GINAWA NATING ARRAY PARA PAYAGAN PAREHO ANG 5173 AT 5174
    origin: ['http://localhost:5173', 'http://localhost:5174'], 
    credentials: true,               
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'self' http://localhost:8080;");
  next();
});

// JSON Limit para sa profile picture
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Session
app.use(session({
    secret: process.env.SECRET_KEY || 'default_secret_key', // Nilagyan ng fallback just in case
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

// 1. Sabihin sa Express na i-serve ang 'dist' folder (kung saan nandoon ang compiled React app mo)
// Note: Kung 'build' ang pangalan ng folder mo imbes na 'dist', palitan mo lang yung word na 'dist' dito.
app.use(express.static(path.join(__dirname, 'dist')));

// 2. CATCH-ALL ROUTE: Kapag may ni-refresh na page ang user (e.g., /admin/dashboard), 
// hindi iisipin ng Express na API route ito, ibabato niya pabalik sa React.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// =======================================================================

const port = process.env.PORT || 8080; // Dinagdag ang process.env.PORT para sa Render
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});