#!/usr/bin/env bash
# bootstrap-azure.sh — One-time setup for AYC Communities on Azure.
#
# Run AFTER `az login` (and `az account set` if you have multiple subscriptions).
# This script is idempotent: re-running it safely skips already-created resources.
#
# Usage:
#   chmod +x scripts/bootstrap-azure.sh
#   ./scripts/bootstrap-azure.sh
#
# What it creates:
#   1. Resource group:         rg-ayc (UK South)
#   2. Resource providers:     ContainerRegistry, DBforPostgreSQL, App, OperationalInsights
#   3. App Registration:       gh-ayc-deploy  (identity used by GitHub Actions)
#   4. Service principal for the app registration
#   5. Owner role on rg-ayc    (Owner required — Bicep creates AcrPull role assignments)
#   6. OIDC federated credential scoped to MikeWedderburn-Clarke/Communities main branch
#   7. Generates DB_ADMIN_PASSWORD and AUTH_SECRET
#
# Output: copy-paste table of all GitHub secrets and variables.

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
APP_NAME="ayc"
LOCATION="uksouth"
RG="rg-${APP_NAME}"
SP_NAME="gh-${APP_NAME}-deploy"
REPO="MikeWedderburn-Clarke/Communities"
BRANCH="main"

# Derived names — must match infra/main.bicep derivation logic:
#   ACR: replace(appName, '-', '') + 'cr'  → ayccr
#   DB:  appName + '-db'                   → ayc-db
ACR_NAME="${APP_NAME}cr"        # ayccr
DB_SERVER="${APP_NAME}-db"      # ayc-db
DB_USER="pgadmin"               # default in infra/modules/database.bicep
DB_NAME="communities"           # default in infra/modules/database.bicep

# ─── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  AYC Communities — Azure Bootstrap               ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ─── Pre-flight checks ────────────────────────────────────────────────────────
echo "▶ Checking prerequisites..."

if ! command -v az &>/dev/null; then
  echo "  ERROR: Azure CLI not found."
  echo "  Install: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli"
  exit 1
fi

if ! az account show &>/dev/null; then
  echo "  ERROR: Not logged in to Azure. Run: az login"
  exit 1
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
ACCOUNT_NAME=$(az account show --query name -o tsv)

echo "  Subscription : ${ACCOUNT_NAME} (${SUBSCRIPTION_ID})"
echo "  Tenant       : ${TENANT_ID}"
echo "  Region       : ${LOCATION}"
echo ""

# ─── Resource group ───────────────────────────────────────────────────────────
echo "▶ Creating resource group: ${RG} (${LOCATION})..."
az group create --name "${RG}" --location "${LOCATION}" --output none
echo "  ✓ Resource group ready"
echo ""

# ─── Resource providers ───────────────────────────────────────────────────────
# Required on fresh subscriptions. Idempotent — safe to re-run.
echo "▶ Registering resource providers (one-time, subscription-level)..."
az provider register --namespace Microsoft.ContainerRegistry --wait
az provider register --namespace Microsoft.DBforPostgreSQL --wait
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait
echo "  ✓ Providers registered"
echo ""

# ─── App Registration ─────────────────────────────────────────────────────────
echo "▶ Ensuring App Registration: ${SP_NAME}..."

EXISTING_APP_ID=$(az ad app list \
  --display-name "${SP_NAME}" \
  --query "[0].appId" -o tsv 2>/dev/null || true)

if [ -n "${EXISTING_APP_ID}" ] && [ "${EXISTING_APP_ID}" != "None" ]; then
  CLIENT_ID="${EXISTING_APP_ID}"
  echo "  ✓ Already exists (appId: ${CLIENT_ID})"
else
  CLIENT_ID=$(az ad app create \
    --display-name "${SP_NAME}" \
    --query appId -o tsv)
  echo "  ✓ Created (appId: ${CLIENT_ID})"
fi
echo ""

# ─── Service Principal ────────────────────────────────────────────────────────
echo "▶ Ensuring service principal..."

EXISTING_SP=$(az ad sp list \
  --filter "appId eq '${CLIENT_ID}'" \
  --query "[0].id" -o tsv 2>/dev/null || true)

if [ -n "${EXISTING_SP}" ] && [ "${EXISTING_SP}" != "None" ]; then
  SP_OBJECT_ID="${EXISTING_SP}"
  echo "  ✓ Already exists (objectId: ${SP_OBJECT_ID})"
else
  SP_OBJECT_ID=$(az ad sp create --id "${CLIENT_ID}" --query id -o tsv)
  echo "  ✓ Created (objectId: ${SP_OBJECT_ID})"
fi
echo ""

# ─── Role assignment — Owner on resource group ────────────────────────────────
echo "▶ Ensuring Owner role on ${RG}..."
echo "  (Owner is required: Bicep grants the Container App identity AcrPull on the registry)"

RG_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RG}"

EXISTING_ROLE=$(az role assignment list \
  --assignee "${SP_OBJECT_ID}" \
  --role Owner \
  --scope "${RG_SCOPE}" \
  --query "[0].id" -o tsv 2>/dev/null || true)

if [ -n "${EXISTING_ROLE}" ] && [ "${EXISTING_ROLE}" != "None" ]; then
  echo "  ✓ Already assigned"
else
  az role assignment create \
    --assignee-object-id "${SP_OBJECT_ID}" \
    --assignee-principal-type ServicePrincipal \
    --role Owner \
    --scope "${RG_SCOPE}" \
    --output none
  echo "  ✓ Owner role assigned"
fi
echo ""

# ─── OIDC Federated Credential ────────────────────────────────────────────────
echo "▶ Ensuring OIDC federated credential..."

FC_NAME="github-main"
FC_SUBJECT="repo:${REPO}:ref:refs/heads/${BRANCH}"

EXISTING_FC=$(az ad app federated-credential list \
  --id "${CLIENT_ID}" \
  --query "[?name=='${FC_NAME}'].id" -o tsv 2>/dev/null || true)

if [ -n "${EXISTING_FC}" ]; then
  echo "  ✓ Already exists"
else
  az ad app federated-credential create \
    --id "${CLIENT_ID}" \
    --parameters "{
      \"name\": \"${FC_NAME}\",
      \"issuer\": \"https://token.actions.githubusercontent.com\",
      \"subject\": \"${FC_SUBJECT}\",
      \"description\": \"GitHub Actions — main branch\",
      \"audiences\": [\"api://AzureADTokenExchange\"]
    }" \
    --output none
  echo "  ✓ Created (subject: ${FC_SUBJECT})"
fi
echo ""

# ─── Generate secrets ─────────────────────────────────────────────────────────
echo "▶ Generating secrets..."

# DB password: 'Ayc' prefix (uppercase A, lowercase y+c) + 24 hex chars (lowercase + digits)
# + '1!' suffix (digit + non-alphanumeric) → all 4 Azure PG complexity categories.
DB_ADMIN_PASSWORD="Ayc$(openssl rand -hex 12)1!"

# NextAuth secret
AUTH_SECRET="$(openssl rand -base64 32)"

# Pre-build connection string using the names Bicep will create.
# This matches the format in infra/modules/database.bicep.
DB_FQDN="${DB_SERVER}.postgres.database.azure.com"
DATABASE_URL="postgres://${DB_USER}:${DB_ADMIN_PASSWORD}@${DB_FQDN}:5432/${DB_NAME}?sslmode=require"

echo "  ✓ Done"
echo ""

# ─── Print GitHub configuration ───────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║  Copy these into your GitHub repository:                                ║"
echo "║  Settings → Secrets and variables → Actions                             ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "── SECRETS  (Settings → Secrets → New repository secret) ──────────────────"
echo ""
printf "  %-28s = %s\n" "AZURE_CLIENT_ID"       "${CLIENT_ID}"
printf "  %-28s = %s\n" "AZURE_TENANT_ID"       "${TENANT_ID}"
printf "  %-28s = %s\n" "AZURE_SUBSCRIPTION_ID" "${SUBSCRIPTION_ID}"
printf "  %-28s = %s\n" "DB_ADMIN_PASSWORD"     "${DB_ADMIN_PASSWORD}"
printf "  %-28s = %s\n" "DATABASE_URL"           "${DATABASE_URL}"
printf "  %-28s = %s\n" "AUTH_SECRET"            "${AUTH_SECRET}"
echo ""
echo "── VARIABLES  (Settings → Secrets → Variables tab → New variable) ─────────"
echo ""
printf "  %-28s = %s\n" "AZURE_REGISTRY"        "${ACR_NAME}.azurecr.io"
printf "  %-28s = %s\n" "AZURE_APP_NAME"        "${APP_NAME}"
printf "  %-28s = %s\n" "AZURE_RESOURCE_GROUP"  "${RG}"
echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║  Next steps:                                                             ║"
echo "║  1. Add all secrets and variables above to GitHub (Settings above)       ║"
echo "║  2. Actions tab → Infrastructure → Run workflow  (deploys Azure infra)   ║"
echo "║  3. Wait ~5 min until the workflow succeeds                               ║"
echo "║  4. Push any commit to main (or re-run deploy.yml) to ship the app       ║"
echo "║  5. See the plan in scripts/bootstrap-azure.sh for Entra setup later     ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""
