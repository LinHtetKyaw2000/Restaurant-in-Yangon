import cors from "cors";
import express from "express";
import { config } from "./config.js";
import restaurantsRouter from "./routes/restaurants.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", restaurantsRouter);

app.use((error, _req, res, _next) => {
  const status = error.status ?? 500;
  const message = error.message ?? "Internal server error";
  const details = error.details ?? null;
  res.status(status).json({ error: message, details });
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server running on http://localhost:${config.port}`);
});
