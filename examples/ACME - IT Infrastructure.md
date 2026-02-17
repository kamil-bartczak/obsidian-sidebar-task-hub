# ACME – IT Infrastructure

Team: DevOps & Platform
Lead: Priya Nair

---

## Security & Compliance

- [x] Rotate all production secrets (annual cycle)
- [x] Enable MFA enforcement for all SSO accounts
- [x] Patch CVE-2025-44832 on app servers
- [x] Complete SOC 2 Type II evidence collection
- [ ] Penetration test — schedule external vendor (Q2 window)
- [ ] Review and update incident response runbook
- [ ] Enable audit logging on production database cluster

## Cloud & Networking

- [x] Migrate object storage from us-east-1 to eu-central-1 (GDPR)
- [x] Set up VPC peering — staging ↔ production read replica
- [ ] Evaluate spot-instance strategy for batch workloads
- [ ] Implement egress cost alerts (budget: $500/month threshold)
- [ ] Document disaster-recovery runbook for primary region failure
- [ ] Automate SSL certificate renewal via Certbot + cron

## Observability

- [x] Deploy Grafana dashboards for all microservices
- [x] Configure PagerDuty escalation policies
- [ ] Add distributed tracing (OpenTelemetry) to checkout service
- [ ] Set SLO burn-rate alerts — error budget < 10 % triggers P1
- [ ] Archive logs older than 90 days to cold storage

## Developer Experience

- [x] Upgrade CI runners — macOS silicon for iOS builds
- [x] Add dependency review action to all repos
- [ ] Provision ephemeral preview environments per PR
- [ ] Reduce average CI pipeline time from 18 min to under 10 min
- [ ] Document local dev setup — onboarding guide for new hires
- [ ] Evaluate Nx for monorepo build caching
