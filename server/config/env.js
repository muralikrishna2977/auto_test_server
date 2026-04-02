import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_ENV = process.env.NODE_ENV || "development";
const envFile = `.env.${NODE_ENV}`;

dotenv.config({
  path: path.resolve(__dirname, `../${envFile}`),
});

console.log(`[ENV] Loaded ${envFile}`);
