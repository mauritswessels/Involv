import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/readiness", (_req, res) => {
  res.json({ status: "ready" });
});

export default router;