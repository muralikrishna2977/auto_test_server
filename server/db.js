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



// db.js for neon
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // REQUIRED for Neon
  },
});

pool
  .connect()
  .then(() => console.log("Connected to Neon PostgreSQL"))
  .catch(err =>
    console.error("PostgreSQL connection error:", err.message)
  );


