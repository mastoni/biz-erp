# SKMNet-ERP Operational Runbook

## Uptime Monitoring

### 1. Staging Uptime Monitor
The primary black-box availability monitor is configured via an external HTTPS monitoring service (e.g., UptimeRobot Free tier). This ensures independent verification of service availability without requiring VPS agents or new inbound firewall ports.

### 2. Monitor Target
**URL:** `https://staging-api.skmnetwork.com/health`

### 3. Expected Healthy Response
**HTTP 200 OK**
Indicates both the API process and the PostgreSQL database are healthy and responding to queries.

### 4. Expected Degraded Response
**HTTP 503 Service Unavailable**
Indicates the API is running, but PostgreSQL is unavailable or rejecting connections.

### 5. Alert Severity
- **CRITICAL**: Timeout / Connection Refused / HTTPS Unavailable. Indicates Nginx is down, the host is offline, or DNS/Network failure.
- **HIGH**: HTTP 503 from `/health`. Indicates database failure or connection pool exhaustion.
- **RECOVERY**: Service returns to HTTP 200.

### 6. Monitoring Interval
**5 minutes** (Initial free-tier monitoring configuration).

### 7. False-Positive Policy
A retry/grace period is required before treating a transient network failure as a confirmed incident. The external monitor should attempt at least one immediate retry before firing an alert notification.

---

## Recovery Procedures

### 8. General Recovery Flow
1. Identify the failing component via monitor alerts (CRITICAL vs HIGH).
2. SSH into the staging VPS.
3. Check container statuses: `docker ps`
4. Inspect logs of the failing service.
5. Restart the affected container.
6. Verify recovery via the `/health` endpoint.

### 9. API Container Recovery
- **Symptoms**: 502 Bad Gateway from Nginx, or `docker ps` shows container restarting.
- **Logs**: `docker logs bizerp_staging_api --tail 100`
- **Recovery**: `docker restart bizerp_staging_api`

### 10. Nginx Recovery
- **Symptoms**: Connection Refused or Timeout from external monitor.
- **Logs**: `docker logs bizerp_staging_nginx --tail 100`
- **Recovery**: `docker restart bizerp_staging_nginx`

### 11. PostgreSQL Recovery
- **Symptoms**: HTTP 503 from `/health` endpoint.
- **Logs**: `docker logs bizerp_staging_postgres --tail 100`
- **Recovery**: `docker restart bizerp_staging_postgres`
- *Note: If data corruption is suspected, refer to `ops/backup/restore-postgres.sh`.*

### 12. HTTPS Troubleshooting
- **Symptoms**: SSL Handshake failure or connection timeout.
- **Validation**: `curl -Iv https://staging-api.skmnetwork.com/health`
- **Check Nginx config**: `docker exec bizerp_staging_nginx nginx -t`
- **Recovery**: If config is valid, restart Nginx. If certs are missing, see below.

### 13. Let's Encrypt / Certificate Troubleshooting
- The Let's Encrypt renewal mechanism is handled via standard ACME challenges.
- **Validation**: Perform a dry-run to verify renewal capability: `certbot renew --dry-run`
- **Logs**: Check Certbot renewal logs in `/var/log/letsencrypt` or via the respective Certbot container/cron job.

### 14. Verification Commands
- **Internal API Check**: `curl http://127.0.0.1:8080/health`
- **External Public Check**: `curl -s https://staging-api.skmnetwork.com/health`
- **Database Connection Check**: `docker exec bizerp_staging_postgres pg_isready -U bizerp_staging -d bizerp_staging`
- **Docker Health Status**: `docker inspect --format='{{json .State.Health}}' bizerp_staging_api`

### 15. Firewall Invariants
The following security posture MUST be maintained at all times:
- **Port 5432 (PostgreSQL)**: MUST remain CLOSED to the public.
- **Port 8080 (Internal API)**: MUST remain CLOSED to the public.
*(Only ports 22, 80, and 443 are permitted to be open).*

### 16. Escalation Guidance
1. If standard container restarts fail to resolve the incident within 15 minutes, escalate to the Lead Backend Engineer.
2. If PostgreSQL data loss or corruption is suspected, immediately halt the API and escalate to the Database Administrator before attempting restoration.
3. For VPS host-level failures (unreachable via SSH), escalate to the Cloud Provider support or Infrastructure Lead.

### 17. Incident Recording
Following any HIGH or CRITICAL alert that requires manual intervention, a post-mortem must be recorded in the incident log. The log must include:
- Timestamp of the alert.
- Root cause identified.
- Resolution steps taken.
- Time to recovery (TTR).

---

## Controlled Failure Simulation (Staging Only)
*IMPORTANT: NEVER perform these simulations against production.*

### Validated Tests
1. **PostgreSQL unavailable (TESTED AND VALIDATED)**: 
   - **Command**: `docker stop bizerp_staging_postgres`
   - **Result**: External monitor detects HTTP 503 and sends HIGH alert via email.
   - **Recovery**: `docker start bizerp_staging_postgres`
   - **Result**: External monitor detects HTTP 200 and sends RECOVERY alert via email.

### Future/Untested Scenarios
The following tests have not yet been performed and are documented for future validation:
2. **API container unavailable**: `docker stop bizerp_staging_api` (Expect CRITICAL alert / 502 Bad Gateway)
3. **Nginx unavailable**: `docker stop bizerp_staging_nginx` (Expect CRITICAL alert / Timeout)
4. **HTTPS unavailable**: Temporarily rename certificates in the Nginx volume and reload (Expect CRITICAL alert / SSL Error).
