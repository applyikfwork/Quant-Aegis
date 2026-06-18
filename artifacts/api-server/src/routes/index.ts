import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketRouter from "./market";
import strategiesRouter from "./strategies";
import signalsRouter from "./signals";
import tradesRouter from "./trades";
import analyticsRouter from "./analytics";
import dashboardRouter from "./dashboard";
import backtestsRouter from "./backtests";
import systemRouter from "./system";
import aiRouter from "./ai";
import paperTradingRouter from "./paper-trading";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketRouter);
router.use(strategiesRouter);
router.use(signalsRouter);
router.use(tradesRouter);
router.use(analyticsRouter);
router.use(dashboardRouter);
router.use(backtestsRouter);
router.use(systemRouter);
router.use(aiRouter);
router.use(paperTradingRouter);

export default router;
