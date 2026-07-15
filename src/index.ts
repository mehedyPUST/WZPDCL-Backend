// import app from './app';
// import { connectDB } from './db';

// const PORT = process.env.PORT || 5000;

// connectDB().then(() => {
//     app.listen(PORT, () => {
//         console.log(`Server running on port ${PORT}`);
//     });
// });


import app from './app';
import { connectDB } from './db';

const PORT = process.env.PORT || 3000;

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