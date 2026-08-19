import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import osintRoutes from "./routes/osint.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/osint", osintRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Sentinel Backend ejecutándose en http://localhost:${PORT}`);
});