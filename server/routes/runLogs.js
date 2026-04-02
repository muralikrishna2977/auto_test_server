import express from "express";
import fs from "fs";
import path from "path";
import { FRAMEWORK_PATH } from "../constants.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/logs", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const offset = Number(req.query.offset || 0);

  const logPath = path.join(
    FRAMEWORK_PATH,
    `users/user_${userId}/execution.log`
  );

  if (!fs.existsSync(logPath)) {
    return res.json({ data: "", nextOffset: offset });
  }

  const size = fs.statSync(logPath).size;

  if (offset >= size) {
    return res.json({ data: "", nextOffset: offset });
  }

  const stream = fs.createReadStream(logPath, {
    start: offset,
    end: size,
  });

  let data = "";

  stream.on("data", chunk => {
    data += chunk.toString();
  });

  stream.on("end", () => {
    res.json({
      data,
      nextOffset: size,
    });
  });
});

export default router;
