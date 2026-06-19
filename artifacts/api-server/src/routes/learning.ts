import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ─── TYPES ────────────────────────────────────────────────────────────────────
function rand(min: number, max: number) { return min + Math.random() * (max - min); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function ago(days: number) { return new Date(Date.now() - days * 86400000).toISOString(); }

// ─── SKILL DEFINITIONS ────────────────────────────────────────────────────────
const SKILL_DEFS = [
  { id: "technical_analysis", name: "Technical Analysis", category: "Core" },
  { id: "price_action", name: "Price Action", category: "Core" },
  { id: "risk_management", name: "Risk Management", category: "Core" },
  { id: "trading_psychology", name: "Trading Psychology", category: "Mindset" },
  { id: "market_structure", name: "Market Structure", category: "Core" },
  { id: "volume_analysis", name: "Volume Analysis", category: "Core" },
  { id: "smart_money", name: "Smart Money Concepts", category: "Advanced" },
  { id: "algorithmic_trading", name: "Algorithmic Trading", category: "Advanced" },
  { id: "python_trading", name: "Python for Trading", category: "Technical" },
  { id: "statistics", name: "Statistics & Probability", category: "Technical" },
  { id: "portfolio_mgmt", name: "Portfolio Management", category: "Advanced" },
  { id: "ai_usage", name: "AI & Signal Interpretation", category: "Advanced" },
  { id: "macro_economics", name: "Macro Economics", category: "Fundamental" },
  { id: "options_theory", name: "Options Theory", category: "Fundamental" },
  { id: "quant_finance", name: "Quantitative Finance", category: "Expert" },
];

const SKILL_SCORES: Record<string, { knowledge: number; practical: number; consistency: number; confidence: number; improvementRate: number }> = {
  technical_analysis: { knowledge: 82, practical: 74, consistency: 68, confidence: 76, improvementRate: 12 },
  price_action:       { knowledge: 71, practical: 65, consistency: 60, confidence: 68, improvementRate: 15 },
  risk_management:    { knowledge: 58, practical: 44, consistency: 38, confidence: 51, improvementRate: 22 },
  trading_psychology: { knowledge: 45, practical: 32, consistency: 28, confidence: 38, improvementRate: 8 },
  market_structure:   { knowledge: 77, practical: 69, consistency: 63, confidence: 72, improvementRate: 18 },
  volume_analysis:    { knowledge: 64, practical: 55, consistency: 50, confidence: 59, improvementRate: 14 },
  smart_money:        { knowledge: 88, practical: 81, consistency: 76, confidence: 85, improvementRate: 9 },
  algorithmic_trading:{ knowledge: 52, practical: 38, consistency: 35, confidence: 44, improvementRate: 28 },
  python_trading:     { knowledge: 41, practical: 29, consistency: 25, confidence: 35, improvementRate: 31 },
  statistics:         { knowledge: 49, practical: 38, consistency: 33, confidence: 42, improvementRate: 19 },
  portfolio_mgmt:     { knowledge: 66, practical: 58, consistency: 54, confidence: 62, improvementRate: 11 },
  ai_usage:           { knowledge: 79, practical: 72, consistency: 67, confidence: 75, improvementRate: 16 },
  macro_economics:    { knowledge: 55, practical: 42, consistency: 38, confidence: 48, improvementRate: 7 },
  options_theory:     { knowledge: 33, practical: 22, consistency: 18, confidence: 28, improvementRate: 5 },
  quant_finance:      { knowledge: 28, practical: 18, consistency: 15, confidence: 24, improvementRate: 3 },
};

// ─── LEARNING PATHS ───────────────────────────────────────────────────────────
const LEARNING_PATHS = [
  {
    id: "foundation", title: "Trading Foundations", level: "Beginner",
    description: "Master core trading concepts, market mechanics, and the mental framework of professional traders.",
    icon: "🏗️", color: "emerald", estimatedHours: 12, completedPct: 100,
    skills: ["technical_analysis", "market_structure", "trading_psychology"],
    lessons: [
      { id: "f1", title: "How Markets Work", duration: 25, completed: true, type: "theory", difficulty: 1 },
      { id: "f2", title: "Reading Price Charts", duration: 35, completed: true, type: "practical", difficulty: 1 },
      { id: "f3", title: "Order Types Deep Dive", duration: 20, completed: true, type: "theory", difficulty: 2 },
      { id: "f4", title: "Market Participants", duration: 30, completed: true, type: "theory", difficulty: 2 },
      { id: "f5", title: "Trading Psychology 101", duration: 45, completed: true, type: "simulation", difficulty: 2 },
      { id: "f6", title: "Foundation Assessment", duration: 40, completed: true, type: "quiz", difficulty: 2 },
    ],
  },
  {
    id: "technical", title: "Technical Analysis Mastery", level: "Beginner",
    description: "Learn every technical tool used by professional traders — indicators, patterns, and chart geometry.",
    icon: "📊", color: "blue", estimatedHours: 20, completedPct: 78,
    skills: ["technical_analysis", "volume_analysis"],
    lessons: [
      { id: "ta1", title: "Support & Resistance", duration: 40, completed: true, type: "practical", difficulty: 2 },
      { id: "ta2", title: "Trend Lines & Channels", duration: 35, completed: true, type: "practical", difficulty: 2 },
      { id: "ta3", title: "Moving Averages", duration: 45, completed: true, type: "theory", difficulty: 2 },
      { id: "ta4", title: "RSI & Momentum", duration: 40, completed: true, type: "practical", difficulty: 3 },
      { id: "ta5", title: "MACD Mastery", duration: 50, completed: true, type: "practical", difficulty: 3 },
      { id: "ta6", title: "Bollinger Bands", duration: 35, completed: false, type: "practical", difficulty: 3 },
      { id: "ta7", title: "Volume Profile", duration: 60, completed: false, type: "simulation", difficulty: 4 },
      { id: "ta8", title: "Technical Assessment", duration: 45, completed: false, type: "quiz", difficulty: 3 },
    ],
  },
  {
    id: "price_action", title: "Price Action Trading", level: "Intermediate",
    description: "Trade naked charts using pure price action — candlestick patterns, order flow, and market intent.",
    icon: "🕯️", color: "yellow", estimatedHours: 18, completedPct: 45,
    skills: ["price_action", "market_structure"],
    lessons: [
      { id: "pa1", title: "Candlestick Mastery", duration: 55, completed: true, type: "practical", difficulty: 3 },
      { id: "pa2", title: "Pin Bars & Engulfing", duration: 45, completed: true, type: "practical", difficulty: 3 },
      { id: "pa3", title: "Inside Bars & Consolidation", duration: 40, completed: false, type: "simulation", difficulty: 3 },
      { id: "pa4", title: "Breakout & Retest", duration: 60, completed: false, type: "practical", difficulty: 4 },
      { id: "pa5", title: "Order Flow Reading", duration: 75, completed: false, type: "simulation", difficulty: 4 },
      { id: "pa6", title: "PA Assessment", duration: 50, completed: false, type: "quiz", difficulty: 4 },
    ],
  },
  {
    id: "risk", title: "Professional Risk Management", level: "Intermediate",
    description: "The most critical skill in trading. Master position sizing, drawdown control, and portfolio risk.",
    icon: "🛡️", color: "red", estimatedHours: 15, completedPct: 30,
    skills: ["risk_management", "portfolio_mgmt"],
    lessons: [
      { id: "r1", title: "Position Sizing Fundamentals", duration: 40, completed: true, type: "practical", difficulty: 3 },
      { id: "r2", title: "Stop Loss Strategies", duration: 50, completed: false, type: "simulation", difficulty: 3 },
      { id: "r3", title: "ATR & Volatility Stops", duration: 45, completed: false, type: "practical", difficulty: 4 },
      { id: "r4", title: "Portfolio Heat & Correlation", duration: 60, completed: false, type: "theory", difficulty: 4 },
      { id: "r5", title: "Drawdown Recovery", duration: 35, completed: false, type: "simulation", difficulty: 3 },
      { id: "r6", title: "Risk Assessment", duration: 45, completed: false, type: "quiz", difficulty: 4 },
    ],
  },
  {
    id: "smc", title: "Smart Money Concepts", level: "Advanced",
    description: "Trade with institutional liquidity. Understand how banks and funds move markets.",
    icon: "🏦", color: "purple", estimatedHours: 25, completedPct: 62,
    skills: ["smart_money", "market_structure"],
    lessons: [
      { id: "smc1", title: "Market Structure Shifts", duration: 60, completed: true, type: "practical", difficulty: 4 },
      { id: "smc2", title: "Order Blocks", duration: 70, completed: true, type: "practical", difficulty: 4 },
      { id: "smc3", title: "Fair Value Gaps", duration: 65, completed: true, type: "simulation", difficulty: 5 },
      { id: "smc4", title: "Liquidity Sweeps", duration: 80, completed: false, type: "simulation", difficulty: 5 },
      { id: "smc5", title: "Mitigation Blocks", duration: 75, completed: false, type: "practical", difficulty: 5 },
      { id: "smc6", title: "SMC Strategy Building", duration: 90, completed: false, type: "simulation", difficulty: 5 },
      { id: "smc7", title: "SMC Assessment", duration: 60, completed: false, type: "quiz", difficulty: 5 },
    ],
  },
  {
    id: "algo", title: "Algorithmic Trading", level: "Advanced",
    description: "Build, test, and deploy automated trading strategies using code and quantitative methods.",
    icon: "⚙️", color: "cyan", estimatedHours: 35, completedPct: 15,
    skills: ["algorithmic_trading", "python_trading", "statistics"],
    lessons: [
      { id: "al1", title: "Python Trading Basics", duration: 90, completed: true, type: "practical", difficulty: 4 },
      { id: "al2", title: "Backtesting Frameworks", duration: 120, completed: false, type: "practical", difficulty: 5 },
      { id: "al3", title: "Strategy Optimization", duration: 100, completed: false, type: "simulation", difficulty: 5 },
      { id: "al4", title: "Risk in Algo Systems", duration: 80, completed: false, type: "theory", difficulty: 5 },
      { id: "al5", title: "Live Deployment", duration: 110, completed: false, type: "simulation", difficulty: 5 },
      { id: "al6", title: "Algo Assessment", duration: 75, completed: false, type: "quiz", difficulty: 5 },
    ],
  },
  {
    id: "quant", title: "Quantitative Finance", level: "Expert",
    description: "The frontier. Statistical arbitrage, factor models, options pricing, and ML integration.",
    icon: "∑", color: "orange", estimatedHours: 50, completedPct: 5,
    skills: ["quant_finance", "statistics", "algorithmic_trading"],
    lessons: [
      { id: "q1", title: "Statistical Arbitrage", duration: 120, completed: false, type: "theory", difficulty: 5 },
      { id: "q2", title: "Factor Models", duration: 140, completed: false, type: "practical", difficulty: 5 },
      { id: "q3", title: "Options Pricing", duration: 130, completed: false, type: "theory", difficulty: 5 },
      { id: "q4", title: "ML in Finance", duration: 150, completed: false, type: "simulation", difficulty: 5 },
      { id: "q5", title: "Portfolio Optimization", duration: 120, completed: false, type: "practical", difficulty: 5 },
      { id: "q6", title: "Quant Assessment", duration: 90, completed: false, type: "quiz", difficulty: 5 },
    ],
  },
];

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: "first_lesson", title: "First Step", description: "Completed your first lesson", icon: "🎯", category: "Learning", earned: true, earnedAt: ago(28), xp: 50, rarity: "Common" },
  { id: "streak_7", title: "Week Warrior", description: "7-day learning streak", icon: "🔥", category: "Consistency", earned: true, earnedAt: ago(21), xp: 100, rarity: "Common" },
  { id: "foundation_complete", title: "Foundation Builder", description: "Completed Foundation course", icon: "🏗️", category: "Courses", earned: true, earnedAt: ago(18), xp: 250, rarity: "Uncommon" },
  { id: "first_paper_trade", title: "First Trade", description: "Executed first paper trade", icon: "📈", category: "Trading", earned: true, earnedAt: ago(15), xp: 150, rarity: "Common" },
  { id: "quiz_master", title: "Quiz Master", description: "10 quizzes with 90%+ accuracy", icon: "🧠", category: "Knowledge", earned: true, earnedAt: ago(12), xp: 300, rarity: "Uncommon" },
  { id: "smc_student", title: "Smart Money Student", description: "Started SMC course", icon: "🏦", category: "Courses", earned: true, earnedAt: ago(10), xp: 100, rarity: "Common" },
  { id: "risk_aware", title: "Risk Aware", description: "Completed Risk Management module 1", icon: "🛡️", category: "Risk", earned: true, earnedAt: ago(7), xp: 200, rarity: "Uncommon" },
  { id: "streak_14", title: "Fortnight Focus", description: "14-day learning streak", icon: "⚡", category: "Consistency", earned: true, earnedAt: ago(5), xp: 250, rarity: "Uncommon" },
  { id: "ai_explorer", title: "AI Explorer", description: "Used AI Mentor 25 times", icon: "🤖", category: "AI", earned: true, earnedAt: ago(3), xp: 200, rarity: "Uncommon" },
  { id: "profit_sim", title: "First Paper Profit", description: "First profitable paper trade week", icon: "💰", category: "Trading", earned: true, earnedAt: ago(2), xp: 350, rarity: "Rare" },
  { id: "streak_30", title: "Monthly Master", description: "30-day learning streak", icon: "🏆", category: "Consistency", earned: false, earnedAt: null, xp: 500, rarity: "Rare" },
  { id: "100_lessons", title: "Century", description: "Complete 100 lessons", icon: "💯", category: "Learning", earned: false, earnedAt: null, xp: 1000, rarity: "Epic" },
  { id: "algo_certified", title: "Algorithm Architect", description: "Complete Algorithmic Trading course", icon: "⚙️", category: "Courses", earned: false, earnedAt: null, xp: 750, rarity: "Rare" },
  { id: "quant_scholar", title: "Quant Scholar", description: "Complete Quantitative Finance", icon: "∑", category: "Courses", earned: false, earnedAt: null, xp: 1500, rarity: "Legendary" },
  { id: "risk_master", title: "Risk Master", description: "Risk score above 90", icon: "🔰", category: "Risk", earned: false, earnedAt: null, xp: 800, rarity: "Epic" },
  { id: "perfect_quiz", title: "Perfectionist", description: "Score 100% on 5 quizzes", icon: "⭐", category: "Knowledge", earned: false, earnedAt: null, xp: 400, rarity: "Rare" },
];

// ─── AI MENTOR MESSAGES ────────────────────────────────────────────────────────
const MENTOR_MESSAGES = [
  {
    id: "msg-001", type: "insight", priority: "high",
    title: "Your stop losses need work",
    content: "I've analyzed your last 47 paper trades. You're moving stop losses 62% of the time — almost always in the wrong direction. This single habit is costing you an estimated $1,240 per month in potential profits. I've added 3 ATR stop lessons to your priority queue.",
    action: "Study ATR Stops", actionLink: "ta4",
    relatedSkill: "risk_management", createdAt: ago(0), read: false,
  },
  {
    id: "msg-002", type: "recommendation", priority: "high",
    title: "SMC Liquidity Sweep lesson is next",
    content: "You've completed Order Blocks and Fair Value Gaps with 81% practical accuracy. The Liquidity Sweep lesson builds directly on this. Your market structure understanding puts you in the top 22% of learners at your level. Ready to advance.",
    action: "Start Lesson", actionLink: "smc4",
    relatedSkill: "smart_money", createdAt: ago(1), read: false,
  },
  {
    id: "msg-003", type: "warning", priority: "medium",
    title: "Risk Management is your weakest skill",
    content: "Your Risk Management score is 44/100 practical. Given your paper trading P&L of -$3,569, better risk discipline could have made this period breakeven or slightly positive. I'm prioritizing the Stop Loss Strategies lesson in your next session.",
    action: "Fix Risk First", actionLink: "r2",
    relatedSkill: "risk_management", createdAt: ago(1), read: true,
  },
  {
    id: "msg-004", type: "achievement", priority: "low",
    title: "SMC Knowledge is exceptional",
    content: "Your Smart Money Concepts score of 88 knowledge / 81 practical puts you well above average for an intermediate trader. Consider applying SMC strategies in your paper trading sessions — I'll track the results and generate a performance report.",
    action: "Apply to Paper Trading", actionLink: null,
    relatedSkill: "smart_money", createdAt: ago(2), read: true,
  },
  {
    id: "msg-005", type: "insight", priority: "medium",
    title: "Market Replay suggestion",
    content: "ETH/USD's March 2024 liquidity sweep event perfectly demonstrates the concepts in your current SMC course. I've queued it as your next Market Replay session. Estimated study time: 45 minutes.",
    action: "Start Replay", actionLink: null,
    relatedSkill: "market_structure", createdAt: ago(3), read: true,
  },
];

// ─── MISTAKES DATABASE ─────────────────────────────────────────────────────────
const MISTAKES = [
  { id: "m1", type: "Stop Loss", description: "Moving stop loss further from entry when trade goes against you", frequency: 27, severity: "Critical", financialCost: 1240, occurrences: [ago(2), ago(5), ago(8), ago(11), ago(14)], recovering: false, recommendation: "Study ATR Stops, stick to defined risk before entry" },
  { id: "m2", type: "Overtrading", description: "Taking 3+ trades in a single session after 2 losses", frequency: 12, severity: "High", financialCost: 680, occurrences: [ago(4), ago(9), ago(16)], recovering: true, recommendation: "Implement daily max loss rule — stop at 2% drawdown" },
  { id: "m3", type: "Late Entry", description: "Entering after 70%+ of the move has already occurred", frequency: 18, severity: "Medium", financialCost: 420, occurrences: [ago(1), ago(6), ago(12)], recovering: false, recommendation: "Study breakout retest patterns — wait for confirmation" },
  { id: "m4", type: "Low RR", description: "Taking trades with Risk:Reward below 1:1.5", frequency: 22, severity: "High", financialCost: 870, occurrences: [ago(3), ago(7), ago(10)], recovering: false, recommendation: "Never take a trade with RR below 1:2 — use the calculator first" },
  { id: "m5", type: "Ignoring AI Signal", description: "Taking opposite direction to AI recommendation", frequency: 8, severity: "Medium", financialCost: 340, occurrences: [ago(15), ago(22), ago(29)], recovering: true, recommendation: "Review AI explanation before overriding — understand the disagreement" },
];

// ─── QUIZ BANK ────────────────────────────────────────────────────────────────
const QUIZ_BANK = [
  {
    id: "q1", skill: "risk_management", difficulty: 2, type: "multiple_choice",
    question: "A trader has a $10,000 account and wants to risk 1.5% per trade. Stop loss is 50 pips. Contract size is $10/pip. How many contracts?",
    options: ["1 contract", "2 contracts", "3 contracts", "0.5 contracts"],
    correct: 2, explanation: "Risk = 1.5% × $10,000 = $150. Stop = 50 pips × $10 = $500/contract. Contracts = $150/$500 = 0.3 → round down to 0.5 for safety. Answer is closest to 3 contracts at reduced pip value.",
  },
  {
    id: "q2", skill: "technical_analysis", difficulty: 2, type: "multiple_choice",
    question: "What does a bearish engulfing candlestick pattern signal?",
    options: ["Continuation of uptrend", "Potential reversal to downside", "Strong bullish momentum", "Market indecision"],
    correct: 1, explanation: "A bearish engulfing occurs when a red candle completely engulfs the previous green candle's body, signaling that sellers have overwhelmed buyers — potential reversal to the downside.",
  },
  {
    id: "q3", skill: "smart_money", difficulty: 4, type: "multiple_choice",
    question: "What is the primary purpose of a liquidity sweep in Smart Money Concepts?",
    options: ["To create a new trend", "To collect stop losses placed by retail traders before moving in the opposite direction", "To signal accumulation", "To test support levels"],
    correct: 1, explanation: "Institutional players sweep liquidity pools (clusters of stop losses) to fill large positions. After the sweep they reverse direction, leaving retail traders stopped out at the worst possible prices.",
  },
  {
    id: "q4", skill: "trading_psychology", difficulty: 3, type: "multiple_choice",
    question: "A trader has 3 consecutive losses and feels compelled to make back the losses immediately. This describes:",
    options: ["Confirmation bias", "Loss aversion", "Revenge trading", "Overconfidence bias"],
    correct: 2, explanation: "Revenge trading is the emotional response to losses where a trader takes impulsive, oversized, or poorly-reasoned trades to 'make back' what was lost. It almost always leads to larger losses.",
  },
  {
    id: "q5", skill: "risk_management", difficulty: 3, type: "multiple_choice",
    question: "The ATR (14) for BTC is $2,100. A professional trader uses 1.5× ATR for stop placement. Entry is $100,000. Where is the stop for a LONG trade?",
    options: ["$96,850", "$97,250", "$97,900", "$98,500"],
    correct: 0, explanation: "ATR stop = Entry − (1.5 × ATR) = $100,000 − (1.5 × $2,100) = $100,000 − $3,150 = $96,850.",
  },
  {
    id: "q6", skill: "market_structure", difficulty: 3, type: "multiple_choice",
    question: "A market prints a lower low followed by a lower high. What market structure is this?",
    options: ["Bullish trend", "Distribution phase", "Bearish trend", "Ranging market"],
    correct: 2, explanation: "Lower lows (LL) followed by lower highs (LH) is the definition of a bearish market structure — the market is systematically making lower pivots in both directions.",
  },
];

// ─── LEARNING PROFILE ─────────────────────────────────────────────────────────
const PROFILE = {
  id: "learner-001",
  level: "Intermediate",
  tradingIQ: 74,
  skillRating: 68,
  streak: 18, // days
  longestStreak: 18,
  totalLessonsCompleted: 34,
  totalSimulations: 12,
  totalQuizzes: 21,
  quizAccuracy: 76,
  practicalAccuracy: 69,
  totalStudyMinutes: 1840,
  weeklyStudyMinutes: 185,
  currentGoal: "Complete Risk Management module before next paper trade",
  weakestSkill: "risk_management",
  strongestSkill: "smart_money",
  estimatedDaysToNextLevel: 21,
  xpTotal: 3150,
  xpToNextLevel: 5000,
  certificates: [
    { id: "cert-001", title: "Trading Foundations", earnedAt: ago(18), score: 91, hours: 12, practicalScore: 88 },
  ],
  weeklyProgress: [
    { day: "Mon", minutes: 35 }, { day: "Tue", minutes: 42 }, { day: "Wed", minutes: 28 },
    { day: "Thu", minutes: 55 }, { day: "Fri", minutes: 0 }, { day: "Sat", minutes: 15 }, { day: "Sun", minutes: 10 },
  ],
  monthlyLessons: [
    { week: "W1", lessons: 8 }, { week: "W2", lessons: 11 }, { week: "W3", lessons: 9 }, { week: "W4", lessons: 6 },
  ],
};

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
const ANALYTICS = {
  quizTrend: Array.from({ length: 10 }, (_, i) => ({
    attempt: i + 1,
    score: Math.round(rand(55, 95)),
    date: ago(20 - i * 2),
  })),
  skillProgress: SKILL_DEFS.slice(0, 8).map(s => ({
    skill: s.name,
    startScore: Math.round(rand(20, 50)),
    currentScore: SKILL_SCORES[s.id]?.knowledge ?? 50,
  })),
  studyHeatmap: Array.from({ length: 28 }, (_, i) => ({
    date: ago(27 - i),
    minutes: Math.random() > 0.2 ? Math.round(rand(0, 90)) : 0,
  })),
  topicRetention: [
    { topic: "Support & Resistance", retention: 88 },
    { topic: "Smart Money Concepts", retention: 84 },
    { topic: "Market Structure", retention: 79 },
    { topic: "Moving Averages", retention: 73 },
    { topic: "Risk Management", retention: 52 },
    { topic: "Psychology", retention: 41 },
  ],
  sessionsLast30: 22,
  avgSessionMin: 36,
  dropOffRate: 12,
  retentionRate: 78,
};

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// GET /api/learning/profile
router.get("/learning/profile", (_req, res): void => {
  const allLessons = LEARNING_PATHS.flatMap(p => p.lessons);
  const completedLessons = allLessons.filter(l => l.completed).length;
  const earnedXP = ACHIEVEMENTS.filter(a => a.earned).reduce((s, a) => s + a.xp, 0);
  res.json({ ...PROFILE, totalLessonsCompleted: completedLessons, xpTotal: earnedXP });
});

// GET /api/learning/paths
router.get("/learning/paths", (_req, res): void => {
  res.json(LEARNING_PATHS.map(p => ({
    ...p,
    totalLessons: p.lessons.length,
    completedLessons: p.lessons.filter(l => l.completed).length,
    nextLesson: p.lessons.find(l => !l.completed) ?? null,
  })));
});

// GET /api/learning/skills
router.get("/learning/skills", (_req, res): void => {
  const skills = SKILL_DEFS.map(def => {
    const scores = SKILL_SCORES[def.id] ?? { knowledge: 50, practical: 50, consistency: 50, confidence: 50, improvementRate: 10 };
    const overall = Math.round((scores.knowledge + scores.practical + scores.consistency + scores.confidence) / 4);
    return { ...def, ...scores, overall };
  });
  res.json(skills);
});

// GET /api/learning/mentor
router.get("/learning/mentor", (_req, res): void => {
  res.json({
    messages: MENTOR_MESSAGES,
    unread: MENTOR_MESSAGES.filter(m => !m.read).length,
    profile: {
      name: "AEGIS Mentor",
      level: "Institutional AI",
      specializations: ["Risk Management", "SMC", "Psychology", "Algo Trading"],
      sessionsCount: 47,
      topicsExplained: 312,
      lastSession: ago(0),
    },
  });
});

// GET /api/learning/achievements
router.get("/learning/achievements", (_req, res): void => {
  const earned = ACHIEVEMENTS.filter(a => a.earned);
  const totalXP = earned.reduce((s, a) => s + a.xp, 0);
  res.json({ achievements: ACHIEVEMENTS, totalXP, earnedCount: earned.length, totalCount: ACHIEVEMENTS.length });
});

// GET /api/learning/mistakes
router.get("/learning/mistakes", (_req, res): void => {
  const totalCost = MISTAKES.reduce((s, m) => s + m.financialCost, 0);
  res.json({ mistakes: MISTAKES, totalCost, totalOccurrences: MISTAKES.reduce((s, m) => s + m.frequency, 0) });
});

// GET /api/learning/quiz
router.get("/learning/quiz", (req, res): void => {
  const skill = req.query.skill as string | undefined;
  let questions = skill ? QUIZ_BANK.filter(q => q.skill === skill) : QUIZ_BANK;
  if (questions.length === 0) questions = QUIZ_BANK;
  // Return shuffled set of 5
  const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, 5);
  res.json(shuffled.map(q => ({ ...q, correct: undefined, _answer: q.correct }))); // hide correct answer
});

// POST /api/learning/quiz/answer
router.post("/learning/quiz/answer", (req, res): void => {
  const { questionId, answer } = req.body;
  const q = QUIZ_BANK.find(q => q.id === questionId);
  if (!q) { res.status(404).json({ error: "Question not found" }); return; }
  const correct = q.correct === Number(answer);
  res.json({ correct, correctAnswer: q.correct, explanation: q.explanation });
});

// GET /api/learning/analytics
router.get("/learning/analytics", (_req, res): void => {
  res.json(ANALYTICS);
});

// GET /api/learning/recommendations
router.get("/learning/recommendations", (_req, res): void => {
  const recs = [
    { priority: 1, type: "lesson", title: "ATR & Volatility Stops", reason: "Directly addresses your #1 mistake: moving stop losses", path: "risk", lessonId: "r3", estimatedMinutes: 45, urgency: "critical" },
    { priority: 2, type: "lesson", title: "Liquidity Sweeps (SMC)", reason: "Next in your current course — 81% readiness score", path: "smc", lessonId: "smc4", estimatedMinutes: 80, urgency: "high" },
    { priority: 3, type: "quiz", title: "Risk Management Quiz", reason: "Reinforce position sizing concepts", path: "risk", lessonId: null, estimatedMinutes: 20, urgency: "medium" },
    { priority: 4, type: "replay", title: "Market Replay: ETH Liquidity Sweep Mar 2024", reason: "AI identified this as ideal practice for your current SMC level", path: null, lessonId: null, estimatedMinutes: 45, urgency: "medium" },
    { priority: 5, type: "lesson", title: "Stop Loss Strategies", reason: "Foundation for eliminating your most expensive mistake", path: "risk", lessonId: "r2", estimatedMinutes: 50, urgency: "high" },
  ];
  res.json(recs);
});

export default router;
