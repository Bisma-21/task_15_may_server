import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { connectDB } from "./config/db.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "*",
    credentials: false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "stockflow-server" }),
);

const port = Number(process.env.PORT) || 4000;

async function main() {
  await connectDB(process.env.MONGODB_URI);
  app.listen(port, () =>
    console.log(`[server] listening on http://localhost:${port}`),
  );
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
