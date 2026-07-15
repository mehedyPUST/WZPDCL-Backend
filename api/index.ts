// import serverless from 'serverless-http';
// import app from '../src/app';
// import { connectDB } from '../src/db';

// let handler: any;

// async function init() {
//     if (!handler) {
//         await connectDB();
//         handler = serverless(app);
//     }
//     return handler;
// }

// export default async (req: any, res: any) => {
//     const fn = await init();
//     return fn(req, res);
// };


import app from '../src/app';

export default app;
