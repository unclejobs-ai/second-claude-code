# Orchestrator Architecture — v1.4.0

## Plugin Discovery Flow

```mermaid
flowchart TB
    subgraph Session["Session Start"]
        SS[SessionStart Hook]
        PD[plugin-discovery.mjs]
        SS --> PD
    end

    subgraph Scan["Filesystem Scan"]
        PJ[~/.claude/plugins/installed_plugins.json]
        SK1[skills/*/SKILL.md]
        CM1[commands/*.md]
        AG1[agents/*.md]
        MC[.claude-plugin/plugin.json → mcpServers]
        PD --> PJ --> SK1
        PJ --> CM1
        PJ --> AG1
        PJ --> MC
    end

    subgraph Map["Capability Map"]
        CM2[{Plugin → Skills/Commands/MCP map}]
        SK1 --> CM2
        CM1 --> CM2
        AG1 --> CM2
        MC --> CM2
    end

    SS --> |injects| CTX[Active Plugin Dispatch<br/>in system-reminder]
    CM2 --> CTX
```

## Auto-Dispatch Flow

```mermaid
flowchart LR
    subgraph User["User Action"]
        U["'코드 리뷰해줘'"]
    end

    subgraph Hook["prompt-detect hook"]
        INT[Intent Detection]
        DG[Dynamic Dispatch Guide]
        INT --> |PDCA check phase| DG
        DG --> |Skill: coderabbit-code-review| CLI[Claude reads instruction]
    end

    subgraph PDCA["PDCA Orchestrator"]
        CHK[Check Phase]
        RT[orchestrator_route<br/>phase=check]
        CHK --> RT
    end

    subgraph Plugins["External Plugin Ecosystem"]
        CR[coderabbit<br/>code-review, autofix]
        CX[codex<br/>review, adversarial-review]
        AT[agent-teams<br/>team-review, multi-reviewer]
        CV[caveman<br/>caveman-review]
        CC[commit-commands<br/>commit, commit-push-pr]
        FD[frontend-design<br/>frontend-design]
        FDP[frontend-design-pro<br/>design-wizard, etc.]
    end

    U --> INT
    CLI --> CHK
    RT --> |dispatch| CR
    RT --> |dispatch| CX
    RT --> |dispatch| AT

    CHK --> ACT[Act Phase]
    ACT --> |orchestrator_route<br/>phase=act| CC
```

## Plugin Ecosystem (real-time scan results as of 2026-05-02)

```mermaid
pie title 14 External Plugins by Phase Routing
    "CHECK (coderabbit, codex, agent-teams, caveman, posthog, claude-md-mgmt)" : 9
    "DO (frontend-design, frontend-design-pro, codex, claude-mem, agent-teams)" : 8
    "ACT (commit-commands, caveman, coderabbit, codex)" : 7
    "PLAN (claude-mem, agent-teams, frontend-design-pro, codex)" : 6
```

## MCP Tool Surface — 28 Tools Total

```mermaid
graph TB
    subgraph Core["PDCA Core (11 tools)"]
        P1[pdca_get_state]
        P2[pdca_start_run]
        P3[pdca_transition]
        P4[pdca_check_gate]
        P5[pdca_end_run]
        P6[pdca_update_stuck]
        P7[pdca_get_cycle_history]
        P8[pdca_save_insight]
        P9[pdca_get_insights]
        P10[pdca_update_insight]
        P11[pdca_get_metrics]
    end

    subgraph Soul["Soul (6 tools)"]
        S1[soul_get_profile]
        S2[soul_record_observation]
        S3[soul_get_observations]
        S4[soul_retro]
        S5[soul_get_synthesis_context]
        S6[soul_get_readiness]
    end

    subgraph Memory["Memory (2 tools)"]
        M1[project_memory_get]
        M2[project_memory_upsert]
    end

    subgraph Daemon["Daemon (5 tools)"]
        D1[daemon_get_status]
        D2[daemon_schedule_workflow]
        D3[daemon_list_jobs]
        D4[daemon_start_background_run]
        D5[daemon_list_background_runs]
        D6[daemon_queue_notification]
    end

    subgraph Session["Session (1 tool)"]
        SE1[session_recall_search]
    end

    subgraph Orchestrator["Orchestrator (4 tools) — NEW v1.4.0"]
        O1[orchestrator_list_plugins]
        O2[orchestrator_get_plugin]
        O3[orchestrator_route]
        O4[orchestrator_health]
    end
```

## File Architecture

```
second-claude/
│
├── hooks/
│   ├── session-start.mjs          ← Active Plugin Dispatch injection
│   ├── prompt-detect.mjs          ← Dynamic dispatch guide (replaced hardcoded skill-check)
│   └── lib/
│       ├── plugin-discovery.mjs   ← ★ Runtime scanner + dispatch guide generator
│       ├── soul-observer.mjs      ← readSoulReadiness(), readLatestRetro()
│       └── ...
│
├── mcp/
│   ├── pdca-state-server.mjs      ← 28 tools (24 core + 4 orchestrator)
│   └── lib/
│       ├── orchestrator-handlers.mjs  ← ★ orchestrator_* tool implementations
│       ├── soul-handlers.mjs          ← soul_retro, get_synthesis_context, get_readiness
│       └── ...
│
├── tests/
│   ├── mcp/orchestrator-handlers.test.mjs  ← 11 tests
│   └── mcp/soul-handlers.test.mjs          ← +9 soul tests
│
└── config/
    └── stage-contracts.json        ← PDCA phase contracts (applies to external dispatch too)
```
