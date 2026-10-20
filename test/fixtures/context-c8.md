## Context Usage

**Model:** claude-opus-5-5  
**Tokens:** 61.7k / 1m (6%)

### Estimated usage by category

| Category | Tokens | Percentage |
|----------|--------|------------|
| System prompt | 2.5k | 0.2% |
| MCP tools | 630 | 0.1% |
| MCP server instructions | 945 | 0.1% |
| MCP tools (deferred) | 203.5k | 20.4% |
| System tools (deferred) | 13.7k | 1.4% |
| Custom agents | 5.2k | 0.5% |
| Memory files | 23.8k | 2.4% |
| Skills | 21.6k | 2.2% |
| Messages | 7.1k | 0.7% |
| Free space | 905.3k | 90.5% |
| Autocompact buffer | 33k | 3.3% |

### MCP Tools

| Tool | Server | Tokens |
|------|--------|--------|
| mcp__chrome-devtools__click | chrome-devtools | 252 |
| mcp__chrome-devtools__close_page | chrome-devtools | 151 |
| mcp__chrome-devtools__drag | chrome-devtools | 241 |
| mcp__claude_ai_Atlassian_Rovo__addCommentToJiraIssue | claude_ai_Atlassian_Rovo | 546 |
| mcp__claude_ai_Atlassian_Rovo__addTeamworkGraphContext | claude_ai_Atlassian_Rovo | 639 |
| mcp__claude_ai_Atlassian_Rovo__addWorklogToJiraIssue | claude_ai_Atlassian_Rovo | 581 |
| mcp__claude_ai_Claude_Docs__batch | claude_ai_Claude_Docs | 155 |
| mcp__claude_ai_Claude_Docs__create | claude_ai_Claude_Docs | 240 |
| mcp__claude_ai_Claude_Docs__delete | claude_ai_Claude_Docs | 322 |
| mcp__claude_ai_Gmail__apply_sensitive_message_label | claude_ai_Gmail | 451 |
| mcp__claude_ai_Gmail__apply_sensitive_thread_label | claude_ai_Gmail | 380 |
| mcp__claude_ai_Gmail__create_draft | claude_ai_Gmail | 1.7k |
| mcp__claude_ai_HubSpot__discover_hubspot_schema | claude_ai_HubSpot | 2.1k |
| mcp__claude_ai_HubSpot__get_aeo_metrics | claude_ai_HubSpot | 3k |
| mcp__claude_ai_HubSpot__get_campaign_attribution_reports | claude_ai_HubSpot | 2.9k |
| mcp__claude_ai_Slack__slack_add_reaction | claude_ai_Slack | 262 |
| mcp__claude_ai_Slack__slack_create_canvas | claude_ai_Slack | 3.5k |
| mcp__claude_ai_Slack__slack_get_reactions | claude_ai_Slack | 361 |
| mcp__claude_design__ack_comments | claude_design | 349 |
| mcp__claude_design__add_member | claude_design | 306 |
| mcp__claude_design__copy_files | claude_design | 1.3k |
| mcp__context7__query-docs | context7 | 812 |
| mcp__context7__resolve-library-id | context7 | 1.1k |
| mcp__github__add_issue_comment | github | 150 |
| mcp__github__create_branch | github | 238 |
| mcp__github__create_issue | github | 197 |
| mcp__plugin_bm_bm__gsd_add_blocker | plugin_bm_bm | 85 |
| mcp__plugin_bm_bm__gsd_add_decision | plugin_bm_bm | 126 |
| mcp__plugin_bm_bm__gsd_advance_plan | plugin_bm_bm | 62 |
| mcp__plugin_claude-mem_mcp-search__build_corpus | plugin_claude-mem_mcp-search | 472 |
| mcp__plugin_claude-mem_mcp-search__get_observations | plugin_claude-mem_mcp-search | 159 |
| mcp__plugin_claude-mem_mcp-search__important_workflow | plugin_claude-mem_mcp-search | 170 |
| mcp__plugin_context-mode_context-mode__ctx_batch_execute | plugin_context-mode_context-mode | 1.8k |
| mcp__plugin_context-mode_context-mode__ctx_doctor | plugin_context-mode_context-mode | 148 |
| mcp__plugin_context-mode_context-mode__ctx_execute | plugin_context-mode_context-mode | 2k |
| mcp__sequential-thinking__sequentialthinking | sequential-thinking | 1.6k |

### Custom Agents

| Agent Type | Source | Tokens |
|------------|--------|--------|
| bm:gsd-advisor-researcher | Plugin | 64 |
| bm:gsd-ai-researcher | Plugin | 136 |
| bm:gsd-assumptions-analyzer | Plugin | 71 |
| build-error-resolver | User | 91 |
| database-reviewer | User | 94 |
| e2e-runner | User | 124 |

### Memory Files

| Type | Path | Tokens |
|------|------|--------|
| User | C:\Users\nutzer\.claude\CLAUDE.md | 6.7k |
| User | C:\Users\nutzer\.claude\PROFILE.md | 618 |

### Skills

| Skill | Source | Tokens |
|-------|--------|--------|
| agent-reach | User | ~280 |
| arbeitsroutine | User | ~170 |
| briefing-abarbeiten | User | ~230 |
| caveman:caveman-init | Plugin (caveman) | ~40 |
| diagram-design:export-diagram | Plugin (diagram-design) | ~30 |
| diagram-design:import-drawio | Plugin (diagram-design) | ~40 |
| diagram-design:import-mermaid | Plugin (diagram-design) | ~40 |
| claude-mem:babysit | Plugin (claude-mem) | ~70 |
| claude-mem:cloud-sync | Plugin (claude-mem) | ~90 |
| claude-mem:design-is | Plugin (claude-mem) | ~130 |
| superpowers:brainstorming | Plugin (superpowers) | ~80 |
| superpowers:diagnosing-superpowers | Plugin (superpowers) | ~140 |
| superpowers:dispatching-parallel-agents | Plugin (superpowers) | ~50 |
| caveman:cavecrew | Plugin (caveman) | ~90 |
| caveman:caveman | Plugin (caveman) | ~80 |
| ponytail:ponytail | Plugin (ponytail) | ~280 |
| ponytail:ponytail-audit | Plugin (ponytail) | ~140 |
| ponytail:ponytail-debt | Plugin (ponytail) | ~140 |
| context-mode:context-mode | Plugin (context-mode) | ~330 |
| context-mode:ctx-doctor | Plugin (context-mode) | ~60 |
| context-mode:ctx-index | Plugin (context-mode) | ~80 |
| understand-anything:understand | Plugin (understand-anything) | ~50 |
| understand-anything:understand-chat | Plugin (understand-anything) | ~40 |
| understand-anything:understand-dashboard | Plugin (understand-anything) | ~40 |
| ui-ux-pro-max:banner-design | Plugin (ui-ux-pro-max) | ~180 |
| ui-ux-pro-max:brand | Plugin (ui-ux-pro-max) | ~70 |
| ui-ux-pro-max:design | Plugin (ui-ux-pro-max) | ~210 |
| bm:add-backlog | Plugin (bm) | ~30 |
| bm:add-phase | Plugin (bm) | ~20 |
| bm:add-tests | Plugin (bm) | ~30 |
| bm:help | Plugin (bm) | < 20 |
| dataviz | Built-in | ~480 |
| update-config | Built-in | ~240 |
| keybindings-help | Built-in | ~80 |
| brainstorm | claude.ai sync | ~210 |
| built-in-browser | claude.ai sync | ~290 |
| canvas-design | claude.ai sync | ~110 |

