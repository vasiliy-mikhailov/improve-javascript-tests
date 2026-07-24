# improve-javascript-tests: n8n orchestrator + sidecar runner + dashboard, one container.
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get install -y --no-install-recommends git curl ca-certificates jq procps \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

ARG N8N_VERSION=2.32.0
RUN npm install -g --omit=dev n8n@${N8N_VERSION} && npm cache clean --force

# n8n + runtime defaults (overridable via compose env_file)
ENV DATA_DIR=/data \
    N8N_USER_FOLDER=/data \
    N8N_PORT=5678 \
    SIDECAR_PORT=3000 \
    N8N_USER_MANAGEMENT_JWT_DURATION_HOURS=87600 \
    N8N_SECURE_COOKIE=false \
    N8N_PROXY_HOPS=1 \
    N8N_DIAGNOSTICS_ENABLED=false \
    N8N_PERSONALIZATION_ENABLED=false \
    N8N_VERSION_NOTIFICATIONS_ENABLED=false \
    N8N_TEMPLATES_ENABLED=false \
    N8N_HIRING_BANNER_ENABLED=false \
    EXECUTIONS_TIMEOUT=-1 \
    N8N_RUNNERS_TASK_TIMEOUT=3600 \
    GENERIC_TIMEZONE=UTC

COPY sidecar /app/sidecar
COPY n8n /app/n8n
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh && node /app/n8n/generate-workflows.mjs

VOLUME /data
EXPOSE 5678 3000
ENTRYPOINT ["/app/entrypoint.sh"]
