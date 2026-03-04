# Deployment

The app is deployed to **Azure Container Apps** via a GitHub Actions workflow on every push to `main`.

## Pipeline overview

The workflow at `.github/workflows/deploy.yml` performs these steps in order:

1. **Build** — builds a Docker image from the repo root
2. **Push** — pushes the image to Azure Container Registry
3. **Migrate** — runs `npm run db:migrate` against Azure Postgres
4. **Deploy** — updates the Azure Container App with the new image

## Required GitHub secrets

| Secret | Description |
|---|---|
| `AZURE_CLIENT_ID` | Service principal client ID |
| `AZURE_TENANT_ID` | Azure tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `DATABASE_URL` | Azure Postgres connection string |

## Required GitHub variables

| Variable | Description |
|---|---|
| `AZURE_REGISTRY` | Azure Container Registry hostname (e.g. `myregistry.azurecr.io`) |
| `AZURE_APP_NAME` | Azure Container App name |
| `AZURE_RESOURCE_GROUP` | Azure resource group name |

## Infrastructure

Terraform / Bicep infrastructure definitions (if any) live in the `infra/` directory.

## Environment variables

See `.env.local.example` for the full list of variables needed at runtime. The production container reads these from the Azure Container App's environment configuration.
