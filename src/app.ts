import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import meterRoutes from './routes/meters';
import billRoutes from './routes/bills';
import paymentRoutes from './routes/payments';
import connectionRoutes from './routes/connections';
import complaintRoutes from './routes/complaints';
import reviewRoutes from './routes/reviews';
import publicRoutes from './routes/public';
import adminRoutes from './routes/admin';
import consumerRoutes from './routes/consumers';

const app = express();

// 1. প্রথমেই webhook-এর জন্য raw body parser (যাতে JSON parser-এর আগে body raw থাকে)
app.use('/api/public/webhook', express.raw({ type: 'application/json' }));

// 2. CORS (FRONTEND_URL অবশ্যই .env-তে সেট করা থাকবে)
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

// 3. বাকি সব route-এর জন্য JSON parser
app.use(express.json());

// 4. Routes
app.use('/api/auth', authRoutes);
app.use('/api/meters', meterRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/consumers', consumerRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Root welcome route
app.get('/', (_req, res) => {
    res.json({
        message: 'Welcome to the WZPDCL Backend API',
        status: 'online',
        healthCheck: '/api/health',
        documentation: 'https://github.com/mehedyPUST/WZPDCL-Backend'
    });
});

export default app;