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
npx prisma db push
```

#### What do these commands do and why do we need them?
- **`npx prisma generate`**: This command reads your `schema.prisma` file and generates the Prisma Client (a customized, type-safe query builder) inside your `node_modules`. You need to run this whenever you update your schema so that your backend code can autocomplete and safely query your database using the latest models.

- **`npx prisma db push`**: This command takes the models defined in your `schema.prisma` file and directly updates your actual database schema (creates tables, columns, etc.) to match it. It's used during development to quickly sync your database structure without dealing with complex migration files.

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
