import { Router } from "express";
import * as z from "zod";
import { requireAuth } from "../middleware/require-auth.js";
import { getDashboard } from "../services/dashboard.service.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

const dashboardQuerySchema = z.object({
  tzOffsetMinutes: z.coerce.number().int().min(-720).max(840).optional(),
});

dashboardRouter.get("/", async (req, res) => {
  const parsed = dashboardQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  const dashboard = await getDashboard(res.locals.userId, parsed.data.tzOffsetMinutes ?? 0);
  res.status(200).json(dashboard);
});
