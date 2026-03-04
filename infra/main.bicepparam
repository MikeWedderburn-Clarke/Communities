// Parameter file for local / one-off deployments.
// Secrets should be passed via --parameters flags or fetched from Key Vault in CI.
using 'main.bicep'

param location = 'uksouth'
param appName = 'ayc'

// containerImage is set by the CI pipeline; override here for manual deploys:
// param containerImage = 'ayccr.azurecr.io/ayc:latest'

// Secrets — do NOT commit real values; use environment-specific overrides in CI.
// param dbAdminPassword = ''
// param authSecret = ''
