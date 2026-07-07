# Old Z - Professional PM Methodology Guide

## 🎯 Project Management Framework

### Methodology: Hybrid Agile-Scrum
We use a **practical hybrid approach** combining:
- **Scrum** for iteration planning and team coordination
- **Kanban** for continuous flow and WIP limits
- **Lean** principles for waste reduction

---

## 📋 Core Processes

### 1. Task Lifecycle Management

#### Task States
```
BACKLOG → READY → IN_PROGRESS → IN_REVIEW → TESTING → DONE → RELEASED
```

#### Task Types
- **Feature**: New functionality (2-8 hours estimate)
- **Bug**: Defect fix (1-4 hours)
- **Tech Debt**: Refactoring/improvement (2-6 hours)
- **Spike**: Research/exploration (timeboxed 4 hours)

#### Task Structure (Template)
```markdown
### [ ] Task ID: OLDZ-XXX
**Type**: Feature | Bug | Tech Debt | Spike
**Priority**: P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low)
**Estimate**: X hours
**Owner**: Developer name

**Description**: 
Clear, actionable description of what needs to be done

**Acceptance Criteria**:
- [ ] Criterion 1 (testable)
- [ ] Criterion 2 (testable)
- [ ] No console errors
- [ ] Responsive on target platforms

**Dependencies**:
- Blocks: OLDZ-YYY
- Blocked by: OLDZ-ZZZ

**Files to Create/Edit**:
- path/to/file.ts
- path/to/component.tsx

**Reference**:
- Specification section
- Related issue/PR
```

---

### 2. Sprint Cycle (2-Week Iterations)

#### Sprint Planning (Mondays, 2 hours)
**Participants**: Entire dev team  
**Inputs**: Product backlog, velocity history, team capacity  
**Outputs**: Sprint backlog, sprint goal, task assignments

**Agenda**:
1. Review previous sprint (30 min)
   - Demo completed features
   - Discuss what went well/what didn't
   - Update velocity metrics
   
2. Select sprint backlog (60 min)
   - Pick highest priority tasks
   - Break down large tasks
   - Assign initial owners
   
3. Risk assessment (30 min)
   - Identify dependencies
   - Plan for blockers
   - Allocate buffer time

#### Daily Standup (Every day, 15 min)
**Participants**: Dev team  
**Format**: Async (Slack/Discord) or sync (Zoom)  
**Three Questions**:
1. What did I complete yesterday?
2. What will I work on today?
3. Any blockers or needs help?

**Output**: Updated task status in tracking system

#### Sprint Review (End of sprint, 1 hour)
**Participants**: Dev team + Stakeholders  
**Format**: Demo + Feedback  
**Agenda**:
1. Demo completed features (30 min)
2. Review metrics (15 min)
   - Velocity
   - Burndown chart
   - Bug count
3. Stakeholder feedback (15 min)

#### Sprint Retrospective (After review, 1 hour)
**Participants**: Dev team only  
**Format**: Blameless post-mortem  
**Topics**:
1. What went well? (10 min)
2. What didn't go well? (10 min)
3. Action items for next sprint (10 min)

---

### 3. Quality Gates

#### Definition of Ready (DoR)
A task is "Ready" only if:
- [ ] Clear acceptance criteria defined
- [ ] Design mockups available (if UI task)
- [ ] Dependencies identified
- [ ] Estimate agreed upon
- [ ] No blockers

#### Definition of Done (DoD)
A task is "Done" only if:
- [ ] Code complete and self-reviewed
- [ ] Unit tests written (if applicable)
- [ ] Passes all existing tests
- [ ] Code review approved
- [ ] Deployed to staging
- [ ] QA verified (for features)
- [ ] Documentation updated
- [ ] No console errors/warnings

#### Code Review Checklist
- [ ] Follows coding standards (ESLint clean)
- [ ] No hardcoded secrets
- [ ] Error handling implemented
- [ ] Performance considered
- [ ] Accessibility checked (if UI)
- [ ] Tests cover happy + error paths

---

### 4. Branching Strategy (Git Flow)

```
main (production)
 ↑
release/v0.3.0 (release preparation)
 ↑
develop (integration)
 ↑
feature/OLDZ-123-user-auth (feature branches)
 hotfix/critical-bug (emergency fixes)
```

#### Branch Naming
- Feature: `feature/OLDZ-XXX-short-description`
- Bug: `fix/OLDZ-XXX-bug-description`
- Hotfix: `hotfix/critical-issue`
- Release: `release/v0.3.0`

#### Commit Message Format
```
OLDZ-123: Add user authentication endpoint

- Implement JWT token generation
- Add password hashing with bcrypt
- Create /api/auth/login endpoint

Closes #123
```

#### PR Process
1. Create PR from feature branch to `develop`
2. Fill PR template (auto-generated)
3. Request review from 2 team members
4. Address feedback
5. Merge after approvals + green CI

---

### 5. Release Management

#### Version Numbering (Semantic Versioning)
```
v0.2.0
 │  │ │
 │  │ └─ Patch: Bug fixes (0.2.1, 0.2.2)
 │  └─── Minor: New features (0.3.0, 0.4.0)
 └────── Major: Breaking changes (1.0.0)
```

#### Release Checklist
- [ ] All tasks in sprint completed
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Security scan clean
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Git tag created
- [ ] Release notes drafted
- [ ] Stakeholder approval received

#### Release Types
- **Patch** (0.2.1): Bug fixes, no new features
- **Minor** (0.3.0): New features, backward compatible
- **Major** (1.0.0): Breaking changes, major redesign

---

### 6. Communication Protocols

#### Async Communication (Preferred)
- **Slack/Discord**: Day-to-day coordination
- **GitHub Issues**: Task discussions
- **Pull Request comments**: Code-specific feedback
- **Email**: External stakeholders, formal decisions

#### Sync Communication (When needed)
- **Daily standup**: 15 min, same time daily
- **Sprint events**: As per sprint calendar
- **Ad-hoc**: Immediate blockers, design decisions

#### Escalation Path
```
Developer → Tech Lead (4 hours response)
         ↓
Tech Lead → Project Manager (2 hours)
         ↓
PM → Stakeholders (1 hour)
```

---

### 7. Documentation Standards

#### Required Documentation
- [ ] **README.md**: Project overview, setup instructions
- [ ] **CONTRIBUTING.md**: How to contribute
- [ ] **ARCHITECTURE.md**: System design, data flow
- [ ] **API.md**: Endpoint documentation
- [ ] **CHANGELOG.md**: Version history
- [ ] **DECISIONS.md**: Architecture decision records (ADRs)

#### Documentation Types
- **Code comments**: Complex logic, non-obvious decisions
- **README**: Onboarding, quick start
- **Wiki/Notion**: Detailed guides, tutorials
- **ADR**: Why, not what (decision rationale)

#### Documentation Review
- Part of DoD (Definition of Done)
- Tech writer reviews for clarity
- Update during code review

---

### 8. Risk Management

#### Risk Register
| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|-------------|-------|
| Electron security vulnerability | High | Medium | Regular updates, security audit | Tech Lead |
| Mobile performance issues | Medium | High | Performance testing, profiling | Mobile Dev |
| Key developer departure | High | Low | Documentation, pair programming | PM |

#### Risk Review
- **Weekly**: During sprint planning
- **Monthly**: Dedicated risk assessment meeting
- **Ad-hoc**: When new risks identified

---

### 9. Metrics & KPIs

#### Velocity Metrics
- **Story points completed** per sprint
- **Cycle time**: Task start to done
- **Lead time**: Task request to done
- **Burndown**: Remaining work over time

#### Quality Metrics
- **Defect escape rate**: Bugs found in production
- **Test coverage**: % code covered by tests
- **Code review turnaround**: Time to first review
- **Build success rate**: % successful builds

#### Team Health Metrics
- **Happiness score**: Monthly survey
- **Workload balance**: Tasks per developer
- **Knowledge distribution**: Bus factor
- **Onboarding time**: New dev to first PR

---

### 10. Tools & Integrations

#### Project Management
- **Task tracking**: This `ai/memory-bank/` system
- **Code repository**: GitHub / CNB
- **CI/CD**: GitHub Actions / CNB pipelines
- **Communication**: Slack / Discord / WeCom

#### Development Tools
- **IDE**: VS Code (recommended extensions in `.vscode/`)
- **Linting**: ESLint + Prettier
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Monitoring**: Sentry (errors) + Analytics

#### Documentation
- **Specs**: `ai/memory-bank/site-setup.md`
- **Tasks**: `ai/memory-bank/tasks/OLDZ-XXX.md`
- **Decisions**: `ai/memory-bank/decisions/ADR-XXX.md`
- **Progress**: `ai/memory-bank/progress/YYYY-MM-DD.md`

---

## 🚀 Implementation Roadmap

### Week 1: Foundation
- [ ] Set up task tracking system (this system)
- [ ] Create initial task backlog
- [ ] Define team roles
- [ ] Set up CI/CD pipeline

### Week 2: Process
- [ ] Implement Git flow
- [ ] Create PR templates
- [ ] Set up code review process
- [ ] Write CONTRIBUTING.md

### Week 3: Quality
- [ ] Add testing framework
- [ ] Set up linting/formatting
- [ ] Create DoR/DoD checklists
- [ ] Implement pre-commit hooks

### Week 4: Optimization
- [ ] Review and adjust processes
- [ ] Document lessons learned
- [ ] Plan for scaling
- [ ] Celebrate wins!

---

## 📚 References & Further Reading

- **Scrum Guide**: https://scrumguides.org/
- **Lean Software Development**: Poppendieck
- **The Phoenix Project**: Gene Kim
- **Accelerate**: Nicole Forsgren
- **Shape Up**: Ryan Singer (37signals)

---

**Document Owner**: Senior Project Manager  
**Last Updated**: 2025-07-07  
**Next Review**: After Week 4 implementation  
**Version**: 1.0
