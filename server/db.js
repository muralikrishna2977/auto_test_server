import "./config/env.js";  // env is loaded
import pkg from "pg";

const { Pool } = pkg;
export const pool = new Pool({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  port: Number(process.env.PG_PORT) || 5432,
});

// console.log("pg ", process.env.PG_DATABASE);

pool
  .connect()
  .then((client) => {
    console.log("Connected to PostgreSQL");
    client.release(); // release test connection
  })
  .catch((err) => console.error("PostgreSQL connection error:", err.message));
