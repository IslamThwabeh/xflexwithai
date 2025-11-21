// server/index-updates.ts
// Add this to your existing server/index.ts or server/app.ts

// Import FlexAI routes
import flexaiRoutes from './routes/flexai';
import adminQuizRoutes from "./routes/admin-quiz-stats";


// ... your existing imports and setup ...

// Register FlexAI routes (add this with your other route registrations)
app.use('/api/flexai', flexaiRoutes);

// Example of where to add it in your existing file:
/*
import express from 'express';
import coursesRoutes from './routes/courses';
import usersRoutes from './routes/users';
import flexaiRoutes from './routes/flexai';  // <-- ADD THIS

const app = express();

// ... middleware setup ...

// Routes
app.use('/api/courses', coursesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/flexai', flexaiRoutes);  // <-- ADD THIS

// ... rest of your server setup ...
*/
app.use("/api/admin/quiz", requireAdmin, adminQuizRoutes);