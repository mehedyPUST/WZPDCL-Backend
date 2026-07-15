import app from './app';
import { connectDB } from './db';

const PORT = process.env.PORT;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Connect to database in the background to prevent startup failure if connection fails or is missing
    connectDB()
        .then(() => {
            console.log('Database initialization check complete');
        })
        .catch((err) => {
            console.error('Database connection failed on startup:', err.message);
        });
});