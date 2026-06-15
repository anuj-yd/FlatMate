# FlatMate

## Project Setup

This project consists of a React frontend, an Express backend, and uses Prisma as an ORM.

### 1. Backend Setup

Open a terminal and navigate to the backend directory:
```bash
cd backend
npm install
```

To run the backend server (using nodemon for development):
```bash
npx nodemon server.js
```
*(Or simply `node server.js`)*

### 2. Prisma Setup

Since Prisma is used for database management, you need to generate the Prisma client and sync your database schema. Since Prisma is installed in the backend:

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
```

#### What do these commands do and why do we need them?
- **`npx prisma generate`**: This command reads your `schema.prisma` file and generates the Prisma Client (a customized, type-safe query builder) inside your `node_modules`. You need to run this whenever you update your schema so that your backend code can autocomplete and safely query your database using the latest models.

- **`npx prisma migrate dev --name init`**: This command reads your Prisma schema, creates a migration file (a history record of your database changes) inside the `prisma/migrations` folder, and applies those changes to your actual PostgreSQL database (like creating the `User` table). It ensures your database schema is properly tracked and synced with your code.

*Note: Make sure your `.env` file contains the correct database connection string (`DATABASE_URL`).*

### 3. Frontend Setup

Open another terminal and navigate to the frontend directory:
```bash
cd frontend
npm install
```

To start the Vite development server:
```bash
npm run dev
```

### 4. Troubleshooting

**Prisma Client Initialization Error (Prisma v7.x)**
If you encounter a `PrismaClientInitializationError` asking for a non-empty `PrismaClientOptions` or saying `Cannot find module './generated/prisma'`, it is likely due to how Prisma 7 handles connections and client generation:

1. **JavaScript Output:** Make sure your `schema.prisma` generator uses `provider = "prisma-client-js"` instead of just `"prisma-client"` so it correctly generates the `index.js` runtime files.
2. **Database Adapters:** Prisma 7 no longer supports using the `url` string directly inside `schema.prisma` for the client connection. You must use database adapters. For PostgreSQL, install the required packages:
   ```bash
   npm install pg @prisma/adapter-pg
   ```
   And initialize your Prisma client in your code like this:
   ```javascript
   const { Pool } = require('pg');
   const { PrismaPg } = require('@prisma/adapter-pg');
   const { PrismaClient } = require('./generated/prisma');

   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
   const adapter = new PrismaPg(pool);
   const prisma = new PrismaClient({ adapter });
   ```

## AI Tools Used

This project was built and developed using **Antigravity**, an advanced agentic AI coding assistant created by Google DeepMind. 

### Key AI Contributions:
- **Architectural Design:** Assisted in designing the Prisma schema (User, Group, Expense, Settlement, etc.) and structuring the Express REST API.
- **CSV Anomaly Engine:** Developed the logic for importing and parsing CSVs, including the 4-Tier Anomaly Detection system that flags Missing Payers, Guest Accounts, and Exact/Conflicting Duplicates.
- **Frontend Wizard UI:** Created the React-based Interactive CSV Wizard for bulk issue resolution.
- **Deployment & Setup:** Provided guidance and debugging for deploying the backend to Render, configuring PostgreSQL (Neon/Supabase) environments, and deploying the Vite React app to Vercel.
