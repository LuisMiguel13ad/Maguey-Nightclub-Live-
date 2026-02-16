# Full Analysis Workflow: Step-by-Step Execution Guide

This document tells you exactly what to do, in what order, and what to save at each step.

---

## Prerequisites

Before starting:
- [ ] Antigravity IDE is open with the Maguey-Nightclub-Live project loaded
- [ ] NotebookLM MCP is connected and working in Antigravity
- [ ] You have a NotebookLM notebook created (name it "Maguey-Nightclub-Analysis")
- [ ] You know your live site URLs for all 3 apps (or can run them locally)
- [ ] Claude Code is available for Step 3

---

## Step 1: Feed NotebookLM Sources FIRST (10 minutes)

**Do this before running any agents.** NotebookLM needs your ground truth documents loaded as sources.

Upload these 10 files to your NotebookLM notebook via MCP:

| # | File | Why |
|---|------|-----|
| 1 | `.planning/PROJECT.md` | Requirements, constraints, key decisions |
| 2 | `.planning/STATE.md` | 376+ architectural decisions, pending TODOs |
| 3 | `.planning/codebase/ARCHITECTURE.md` | System architecture patterns |
| 4 | `.planning/codebase/STACK.md` | Technology stack |
| 5 | `.planning/codebase/STRUCTURE.md` | Directory layout |
| 6 | `ARCHITECTURE_FOR_REVIEW.md` | Comprehensive architecture review |
| 7 | `maguey-pass-lounge/vercel.json` | Security headers + deployment config |
| 8 | `maguey-gate-scanner/vercel.json` | Security headers + deployment config |
| 9 | `maguey-nights/vercel.json` | Security headers + deployment config |
| 10 | `e2e/cypress.config.ts` | E2E test configuration |

Then configure the NotebookLM custom prompt:
```
"You are the Master Architect for Maguey Nightclub Live. Analyze all inputs strictly against the PROJECT.md requirements, STATE.md architectural decisions, and ARCHITECTURE.md patterns provided as sources. Flag any deviations between the documentation and the actual codebase findings."
```

**Checkpoint:** Verify all 10 sources appear in the notebook before proceeding.

---

## Step 2: Run Antigravity Analysis (45-90 minutes)

Open `ANTIGRAVITY_ANALYSIS_PROMPT.md` and paste it into Antigravity.

### Execution Order

The phases run in this order (some can be parallelized):

```
Phase 1 (Parallel)          Phase 1.5 (Parallel)
┌──────────────┐            ┌──────────────────┐
│ Agent 1:     │            │ Agent 4:         │
│ maguey-nights│            │ Shared infra     │
├──────────────┤            │ (e2e, load-tests,│
│ Agent 2:     │            │  scripts, CI/CD, │
│ pass-lounge  │            │  .planning/)     │
├──────────────┤            └──────────────────┘
│ Agent 3:     │
│ gate-scanner │
└──────────────┘
        ↓ (wait for all agents to complete)
Phase 2: Cross-App Integration Analysis
        ↓
Phase 3: NotebookLM Synthesis (via MCP)
  3a. Deep Research (industry comparison)
  3b. Mind Map (architecture)
  3c. Data Table (feature matrix)
  3d. Audio Overview (deep dive)
  3e. Source Feeding (already done in Step 1)
  3f. Decision Audit (376+ decisions)
        ↓
Phase 3.5: Live Site Testing (Browser Agents — 3 parallel)
  Browser Agent 1: maguey-nights (Lighthouse + navigation)
  Browser Agent 2: maguey-pass-lounge (Lighthouse + flows)
  Browser Agent 3: maguey-gate-scanner (Lighthouse + scanner)
        ↓
Phase 4: Security & Performance Scan
        ↓
Phase 4.5: Additional Dimensions
  - Accessibility (WCAG 2.1 AA)
  - Dependency Health (npm audit)
  - Bundle Size Analysis
  - Code Duplication
  - TypeScript Strictness
  - Browser Compatibility
  - Legal & Compliance
  - Third-Party Service Limits
  - Pending Operational TODOs
        ↓
Phase 5: Compile Deliverables (using output format spec)
```

### What to Save

After Antigravity completes, you should have these 20 deliverables. Save them all:

- [ ] 1. Per-app scan reports (3 files)
- [ ] 2. Shared infrastructure scan report
- [ ] 3. Cross-app integration map
- [ ] 4. Security audit findings
- [ ] 5. Performance concerns
- [ ] 6. Accessibility audit
- [ ] 7. Dependency health report
- [ ] 8. Code health metrics
- [ ] 9. Lighthouse reports (3 apps)
- [ ] 10. Live site screenshots
- [ ] 11. Legal & compliance assessment
- [ ] 12. Third-party service limits report
- [ ] 13. NotebookLM mind map
- [ ] 14. NotebookLM data table
- [ ] 15. NotebookLM audio deep-dive
- [ ] 16. NotebookLM deep research
- [ ] 17. NotebookLM decision audit
- [ ] 18. All issues ranked by severity
- [ ] 19. Pending TODOs assessment
- [ ] 20. Multi-venue scaling summary

**Checkpoint:** Verify all findings use the output format (CATEGORY / Severity / App / File / Finding / Evidence / Recommendation). If not, ask Antigravity to reformat before proceeding.

---

## Step 3: Run Claude Code Deep Analysis (30-60 minutes)

Open a new Claude Code session in the Maguey-Nightclub-Live project.

1. Open `CLAUDE_DEEP_ANALYSIS_PROMPT.md`
2. Copy everything below the "---" line
3. Replace `[PASTE THE ANTIGRAVITY/NOTEBOOKLM RESULTS HERE]` with your Antigravity findings
4. Paste the full prompt into Claude Code

### What Claude Will Do (14 sections)

| Section | What It Does | Type |
|---------|-------------|------|
| 1. Validate Findings | Checks every Antigravity issue against real code | Verification |
| 2. Trace Critical Paths | Follows 4 flows end-to-end through code | Deep analysis |
| 3. Security Deep Dive | Reads actual HMAC, webhook, RLS, auth code | Security |
| 4. Database Integrity | Checks migrations, constraints, indexes | Database |
| 5. What They Missed | Race conditions, webhook ordering, offline conflicts | Reasoning |
| 6. Production Readiness | Ranked must/should/can fix list | Prioritization |
| 7. Scaling Assessment | Multi-venue architecture changes needed | Architecture |
| 8. Dependency Health | npm audit, bundle sizes, outdated packages | Build health |
| 9. Accessibility | Keyboard nav, ARIA, color contrast | Accessibility |
| 10. Decision Validation | Audit 376+ decisions for contradictions | Decision review |
| 11. Test Coverage Gaps | Untested flows, deferred UAT plans | Coverage |
| 12. Code Health Metrics | any types, dead code, TODOs, duplication | Code quality |
| 13. Legal & Compliance | Privacy, terms, PCI, age verification, data retention | Compliance |
| 14. Service Capacity | Stripe/Supabase/Resend/Redis/Sentry/Vercel limits | Capacity |

### What to Save

Claude Code's output will be a single comprehensive report. Save the entire response as:
```
.planning/analysis-prompts/CLAUDE_ANALYSIS_RESULTS.md
```

---

## Step 4: Combine & Prioritize (15 minutes)

After both analyses are complete, you'll have:
- Antigravity's broad scan (20 deliverables)
- Claude's deep analysis (14 sections)
- NotebookLM's synthesis (mind map, audio, data table, research)

### Final Action Items

Ask Claude Code to produce a final unified action list:
```
Based on your analysis and the Antigravity findings, give me a single prioritized action list:

1. CRITICAL (must fix before any user touches the site)
2. HIGH (fix before marketing the site)
3. MEDIUM (fix within first month of operation)
4. LOW (fix when convenient)

For each item: what it is, which file(s), estimated effort, and whether it blocks launch.
```

Save this as `.planning/analysis-prompts/FINAL_ACTION_LIST.md`.

---

## Total Time Estimate

| Step | Duration |
|------|----------|
| 1. Feed NotebookLM sources | 10 min |
| 2. Antigravity full analysis | 45-90 min |
| 3. Claude deep analysis | 30-60 min |
| 4. Combine & prioritize | 15 min |
| **Total** | **~2-3 hours** |

---

## Files Reference

```
.planning/analysis-prompts/
├── WORKFLOW.md                        ← You are here
├── ANTIGRAVITY_ANALYSIS_PROMPT.md     ← Step 2 input
├── CLAUDE_DEEP_ANALYSIS_PROMPT.md     ← Step 3 input
├── CLAUDE_ANALYSIS_RESULTS.md         ← Step 3 output (you create this)
└── FINAL_ACTION_LIST.md               ← Step 4 output (you create this)
```
