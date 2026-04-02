// index.js
import "./config/env.js";  // env is loaded
// import other modules AFTER env is loaded


// for production only
import path from "path";
import helmet from "helmet";


import express from "express";
import cors from "cors";
import pagesRoutes from "./routes/pages.js";
import scenariosRoutes from "./routes/scenarios.js";
import testcasesRoutes from "./routes/testcases.js";
import groupsRoutes from "./routes/groups.js";
import runRoutes from "./routes/run.js";
import dataRoutes from "./routes/data.js";
import signInRoute from "./routes/signin.js";
import signUpRoute from "./routes/signup.js";
import userData from "./routes/userData.js";
import runLogs from "./routes/runLogs.js";

// for production only
import { FRAMEWORK_PATH } from "./constants.js";

const app = express();

app.use(cors());
app.use(express.json());




// for production only
const reportsDir = path.join(FRAMEWORK_PATH, "users");
// Disable CSP ONLY for reports
// for production only
app.use("/reports", helmet({ contentSecurityPolicy: false }));
app.use("/reports", express.static(reportsDir));



// ROUTES
app.use("/", pagesRoutes);
app.use("/", scenariosRoutes);
app.use("/", testcasesRoutes);
app.use("/", groupsRoutes);
app.use("/", runRoutes);
app.use("/", dataRoutes);
app.use("/", signInRoute);
app.use("/", signUpRoute);
app.use("/", userData);
app.use("/", runLogs);


app.get("/", (req, res) => {
  res.send("Automation Framework API is running!");
});

// for production only
const PORT = process.env.PORT || 5001;
// const PORT = process.env.PORT || 8702;


app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});