// Parameter file for local / one-off deployments.
// Secrets should be passed via --parameters flags or fetched from Key Vault in CI.
using 'main.bicep'

param location = 'uksouth'
param appName = 'communities'

// containerImage is set by the CI pipeline; override here for manual deploys:
// param containerImage = 'communitiescr.azurecr.io/communities:latest'

// Secrets — do NOT commit real values; use environment-specific overrides in CI.
// param dbAdminPassword = ''
// param authSecret = ''
