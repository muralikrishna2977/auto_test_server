// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import pagesRoutes from "./routes/pages.js";
import scenariosRoutes from "./routes/scenarios.js";
import testcasesRoutes from "./routes/testcases.js";
import groupsRoutes from "./routes/groups.js";
import runRoutes from "./routes/run.js";
import dataRoutes from "./routes/data.js";
import signInRoute from "./routes/signin.js";
import signUpRoute from "./routes/signup.js";
import userData from "./routes/userData.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://x0patestbot.netlify.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    // allow Postman / curl / server-side
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("/*", cors(corsOptions));

app.use(express.json());

  //  ROUTES
app.use("/", pagesRoutes);
app.use("/", scenariosRoutes);
app.use("/", testcasesRoutes);
app.use("/", groupsRoutes);
app.use("/", runRoutes);
app.use("/", dataRoutes);
app.use("/", signInRoute);
app.use("/", signUpRoute);
app.use("/", userData);

app.get("/", (req, res) => {
  res.send("Automation Framework API is running!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running → http://localhost:${PORT}`)
);
