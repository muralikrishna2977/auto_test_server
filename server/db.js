// // db.js
// import pkg from "pg";
// import dotenv from "dotenv";

// dotenv.config();
// const { Pool } = pkg;

// export const pool = new Pool({
//   host: process.env.PG_HOST,
//   user: process.env.PG_USER,
//   password: process.env.PG_PASSWORD,
//   database: process.env.PG_DATABASE,
//   port: process.env.PG_PORT || 5432,
// });

// pool.connect()
//   .then(() => console.log("Connected to PostgreSQL"))
//   .catch(err => console.error("PostgreSQL connection error:", err.message));


// db.js
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },

  // optional but recommended
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Simple startup health check (does NOT hold a connection)
pool
  .query("SELECT 1")
  .then(() => console.log("Neon PostgreSQL: ready"))
  .catch(err =>
    console.error("Neon PostgreSQL connection failed:", err.message)
  );

// VERY IMPORTANT: prevent Railway crash
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err.message);
});


