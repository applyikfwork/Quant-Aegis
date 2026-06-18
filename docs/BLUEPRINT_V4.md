# AEGIS QUANT AI — BLUEPRINT V4

# AI BRAIN ARCHITECTURE

## (Memory + Reasoning + Learning System)

This is the most advanced part of the system.

The goal is **not to make an AI that randomly predicts price**.

The goal:

> Create a research intelligence layer that reads market information, compares historical situations, explains decisions, learns from outcomes, and improves the system.

---

## 1. AI Brain Overview

```
                 AI BRAIN

                    |
        --------------------------
        |                        |
   Reasoning Engine        Learning Engine
        |                        |
   Memory System          Performance System
        |                        |
        -------- Database --------
```

---

## 2. AI System Components

The AI has 6 major parts:

```
1. Data Understanding
2. Market Reasoning
3. Historical Memory
4. Decision Support
5. Mistake Analysis
6. Continuous Improvement
```

---

## 3. Data Understanding Layer

AI cannot think without structured data.

Raw input example:

```
BTCUSDT

Price:    105000
Trend:    Bullish
EMA20:    104500
EMA50:    103000
RSI:      56
Volume:   High
ATR:      1200
```

Converted to AI-readable format:

```json
{
  "symbol": "BTCUSDT",
  "market": {
    "trend": "bullish",
    "volatility": "medium"
  },
  "indicators": {
    "ema": "positive",
    "rsi": 56
  }
}
```

---

## 4. Market Reasoning Engine

The "thinking" layer. It asks four questions in sequence:

### Question 1 — What is happening?

```
Market is trending upward
```

### Question 2 — Why?

```
EMA alignment
Volume increase
Higher highs
```

### Question 3 — Have we seen this before?

Search memory database.

### Question 4 — What happened previously?

```
500 similar situations found

340 wins
160 losses

Win rate: 68%
```

---

## 5. AI Memory System

The database IS the memory — not chat history.

Flow:

```
Current Market
        ↓
Search Similar Events
        ↓
Historical Examples
        ↓
AI Analysis
```

Example:

Current conditions:

```
BTC — EMA bullish — RSI 55 — Breakout
```

Database finds:

```
Trade #234 — Same conditions — Result: +3.2%
Trade #876 — Same conditions — Result: -1.1%
```

AI conclusion:

```
Similar situations have mixed results.
Confidence: 72%
```

---

## 6. Vector Memory System (Phase 2)

For advanced memory: vector database.

Purpose: find situations that *behave similarly*, not just match exact indicator values.

Instead of: "Find BTC with RSI 50"

It searches: "Find markets behaving like this"

Architecture:

```
Market Data
        ↓
Embedding Generator
        ↓
Vector Database
        ↓
Similar Situations
        ↓
AI Reasoning
```

Options to evaluate:

- **Qdrant** (self-hosted, free)
- **Pinecone** (managed)
- **Weaviate** (open source)

---

## 7. AI Decision Pipeline

Every trade candidate passes through this full pipeline:

```
Signal Created
        ↓
Market Analysis
        ↓
Strategy Check
        ↓
Risk Check
        ↓
Historical Comparison
        ↓
AI Review
        ↓
Confidence Score
        ↓
Decision
```

---

## 8. Confidence System

Never output a bare signal. Always include evidence:

```
Decision:   BUY
Confidence: 84%

Evidence:
  Trend:    Strong
  Volume:   Confirmed
  History:  78% success rate
  Risk:     Acceptable
```

---

## 9. Multi-Agent Design

Instead of one AI, use multiple specialists.

| Agent | Job | Output |
|-------|-----|--------|
| Market Analyst | Understand market conditions | `Trend: Bullish` |
| Strategy Analyst | Check strategy rules | `Strategy matches: YES` |
| Risk Analyst | Protect account | `Risk: Low` |
| Research Agent | Search historical database | `Similar trades: 250 — Win rate: 74%` |
| Decision Agent | Combine all inputs, issue final verdict | `Decision: BUY — Confidence: 81%` |

---

## 10. AI Database Tables

### ai_memory

Stores market conditions as searchable records (later: embeddings).

```
id               serial PRIMARY KEY
symbol           text
timeframe        text
market_condition jsonb        ← normalized market snapshot
features         jsonb        ← indicator values
embedding        vector       ← (Phase 2, requires pgvector)
outcome          text         ← what happened after
outcome_pct      numeric      ← % result
created_at       timestamp
```

---

### ai_decisions

Records every AI decision with full reasoning.

```
id           serial PRIMARY KEY
signal_id    integer REFERENCES signals(id)
decision     text        ← BUY | SELL | HOLD
confidence   integer     ← 0–100
reasoning    jsonb       ← evidence object
agent_votes  jsonb       ← individual agent outputs
created_at   timestamp
```

---

### ai_feedback

Written after trade closes — the learning record.

```
id            serial PRIMARY KEY
decision_id   integer REFERENCES ai_decisions(id)
trade_id      integer REFERENCES trades(id)
prediction    text        ← what AI said
actual_result text        ← what actually happened
correct       boolean
lesson        text        ← extracted lesson
created_at    timestamp
```

---

### strategy_versions

Version history — never overwrite strategy rules, always create a new version.

```
id              serial PRIMARY KEY
strategy_id     integer REFERENCES strategies(id)
version         integer
entry_rules     jsonb
exit_rules      jsonb
parameters      jsonb
change_reason   text
performance_before jsonb
performance_after  jsonb
created_at      timestamp
```

---

## 11. Learning Engine

Flow after every trade closes:

```
Trade Finished
        ↓
Compare AI Prediction vs Actual Result
        ↓
Correct? ──YES──→ Increase confidence weight for this pattern
        |
       NO
        ↓
Analyze mistake
        ↓
Store lesson to ai_feedback
```

Example:

AI said:
```
BUY — 80% confidence
```

Result:
```
Loss (-2.3%)
```

System records:
```
Mistake:  Bought during low-volume breakout
Lesson:   Require minimum volume = 1.8x average on breakout candles
```

---

## 12. Strategy Evolution System

Every strategy gets versioned. Example:

```
Momentum Strategy V1
        ↓
Research + Learning
        ↓
Momentum Strategy V2
```

Rules:
- Never overwrite existing strategy rules
- Every change stores: old rules, new rules, reason, performance delta
- Rollback is always possible

---

## 13. AI Training Loop (Phase 3)

Long-term improvement cycle:

```
Collect Data
        ↓
Create Labeled Dataset (win/loss per setup)
        ↓
Train Model
        ↓
Backtest
        ↓
Compare to Current System
        ↓
Deploy only if better
```

---

## 14. Machine Learning Layer (Phase 3)

### Classification Model

Predict probability of trade success.

Input features:
```
RSI, EMA alignment, Volume ratio, ATR, ADX, pattern type
```

Output:
```
BUY probability: 0.76
```

**Phase 3 models (start simple):**
- Random Forest
- XGBoost

**Phase 4+ models:**
- Neural Networks
- LSTM (sequence modeling for price patterns)
- Transformer-based models

---

## 15. AI Safety Rules

The AI is **not allowed** to:

- ❌ Ignore risk rules
- ❌ Change strategy parameters without a version record
- ❌ Issue a signal without data
- ❌ Learn from a single trade (minimum batch required)
- ❌ Exceed position size limits
- ❌ Operate without a stop loss

The AI **must always**:

- ✅ Explain every decision with evidence
- ✅ Record everything to database
- ✅ Follow risk limits unconditionally
- ✅ Show confidence with uncertainty, not false precision

---

## 16. Complete AI Flow

```
LIVE MARKET
        ↓
Data Collector
        ↓
Feature Engine (normalize indicators)
        ↓
Historical Memory Search
        ↓
Multi-Agent Reasoning
  ├── Market Analyst
  ├── Strategy Analyst
  ├── Risk Analyst
  ├── Research Agent
  └── Decision Agent
        ↓
Risk Engine (final gate)
        ↓
Decision (BUY / SELL / HOLD + confidence)
        ↓
Trade Execution
        ↓
Result Recorded
        ↓
Learning Engine
        ↓
Improved System
```

---

## 17. Final AI Brain Structure

```
Aegis Brain

├── Perception Layer      ← data normalization, feature extraction
├── Market Understanding  ← trend, volatility, regime classification
├── Memory System         ← historical pattern search
├── Reasoning Engine      ← multi-agent analysis
├── Decision Engine       ← final confidence + verdict
├── Feedback System       ← post-trade outcome recording
├── Learning Engine       ← lesson extraction, weight updates
└── Evolution System      ← strategy versioning, model improvement
```

---

## Implementation Order

| Step | What to build | Phase |
|------|---------------|-------|
| 1 | `ai_memory`, `ai_decisions`, `ai_feedback`, `strategy_versions` tables | Phase 4 |
| 2 | POST `/api/ai/analyze` endpoint | Phase 4 |
| 3 | Basic historical similarity search (SQL) | Phase 4 |
| 4 | Multi-agent reasoning layer (LLM via Replit AI) | Phase 5 |
| 5 | Feedback loop — write outcomes on trade close | Phase 5 |
| 6 | Vector embeddings + pgvector similarity search | Phase 6 |
| 7 | ML classification model (XGBoost) | Phase 7 |
| 8 | Full training loop + model versioning | Phase 8 |

---

## Status

Phase 4: **PLANNED** — database tables and basic reasoning endpoint are the next implementation milestone.

Next blueprint: **V5 — Trading Engine + Backtesting + Strategy Research Lab**
