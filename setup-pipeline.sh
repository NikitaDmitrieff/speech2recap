#!/usr/bin/env bash
set -euo pipefail

#──────────────────────────────────────────────────────────────
# Speech2Recap — Full Pipeline Setup (zero-prompt)
#
# Prerequisites:
#   - Railway CLI: npm install -g @railway/cli && railway login
#   - GitHub CLI: brew install gh && gh auth login
#   - ANTHROPIC_API_KEY in .env.local
#
# Usage:
#   ./setup-pipeline.sh
#──────────────────────────────────────────────────────────────

REPO="nikitadmitrieff/speech2recap"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_CLONE_DIR="/tmp/feedback-chat-agent-$$"
ENV_FILE="$PROJECT_DIR/.env.local"

echo "==> Full Pipeline setup for $REPO"
echo ""

# ── 1. Auto-collect secrets (no prompts) ────────────────────

echo "==> Reading GitHub token from gh CLI..."
GITHUB_TOKEN=$(gh auth token)
echo "==> Got GitHub token"

echo "==> Reading ANTHROPIC_API_KEY from .env.local..."
ANTHROPIC_API_KEY=$(grep "^ANTHROPIC_API_KEY=" "$ENV_FILE" | cut -d= -f2-)
if [[ -z "$ANTHROPIC_API_KEY" ]]; then
  echo "ERROR: ANTHROPIC_API_KEY not found in $ENV_FILE"
  exit 1
fi
echo "==> Got Anthropic API key"

FEEDBACK_PASSWORD=$(openssl rand -hex 16)
WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "==> Generated FEEDBACK_PASSWORD and WEBHOOK_SECRET"

# ── 2. Clone agent ──────────────────────────────────────────

echo "==> Cloning feedback-chat agent..."
git clone --depth 1 https://github.com/NikitaDmitrieff/feedback-chat "$AGENT_CLONE_DIR"
cd "$AGENT_CLONE_DIR/packages/agent"

# ── 3. Deploy to Railway ────────────────────────────────────

echo "==> Creating Railway project..."
railway init --name "speech2recap-agent"

echo "==> Deploying to Railway (creates the service)..."
DEPLOY_OUTPUT=$(railway up --detach 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract project and service IDs from deploy output URL
PROJECT_ID=$(echo "$DEPLOY_OUTPUT" | grep -oE 'project/[a-f0-9-]+' | head -1 | sed 's|project/||')
SERVICE_ID=$(echo "$DEPLOY_OUTPUT" | grep -oE 'service/[a-f0-9-]+' | head -1 | sed 's|service/||')
echo "==> Project: $PROJECT_ID  Service: $SERVICE_ID"

# Link the service so subsequent Railway commands target it
railway service link "$SERVICE_ID"
echo "==> Linked service $SERVICE_ID"

echo "==> Waiting for service to register..."
sleep 10

echo "==> Setting Railway environment variables..."
railway variables set \
  GITHUB_TOKEN="$GITHUB_TOKEN" \
  GITHUB_REPO="$REPO" \
  WEBHOOK_SECRET="$WEBHOOK_SECRET" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"

echo "==> Generating public domain..."
DOMAIN_OUTPUT=$(railway domain 2>&1)
AGENT_URL=$(echo "$DOMAIN_OUTPUT" | grep -oE 'https://[^ ]+' | tail -1 | tr -d '[:space:]')

echo "==> Agent URL: $AGENT_URL"

# Redeploy with env vars
echo "==> Redeploying with environment variables..."
railway up --detach

# ── 4. Create GitHub webhook ────────────────────────────────

WEBHOOK_URL="$AGENT_URL/webhook/github"
echo "==> Creating GitHub webhook at: $WEBHOOK_URL"

gh api "repos/$REPO/hooks" \
  --method POST \
  -f name=web \
  -f "config[url]=$WEBHOOK_URL" \
  -f "config[content_type]=json" \
  -f "config[secret]=$WEBHOOK_SECRET" \
  -f 'events[]=issues' \
  -F active=true

echo "==> Webhook created"

# ── 5. Update local .env.local ──────────────────────────────

update_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i '' "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

update_env "GITHUB_TOKEN" "$GITHUB_TOKEN"
update_env "GITHUB_REPO" "$REPO"
update_env "FEEDBACK_PASSWORD" "$FEEDBACK_PASSWORD"
update_env "AGENT_URL" "$AGENT_URL"

echo "==> Updated $ENV_FILE"

# ── 6. Cleanup ──────────────────────────────────────────────

rm -rf "$AGENT_CLONE_DIR"

echo ""
echo "==> Done! Full pipeline is live."
echo ""
echo "   Agent URL:     $AGENT_URL"
echo "   Webhook:       $WEBHOOK_URL"
echo "   Password:      $FEEDBACK_PASSWORD"
echo "   Status API:    /api/feedback/status"
echo "   Chat API:      /api/feedback/chat"
echo ""
echo "   Start your app: npm run dev"
