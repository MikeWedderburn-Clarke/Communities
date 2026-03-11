/*
  Communities platform — Azure infrastructure entry point.

  Deploys:
    1. Azure Container Registry (Basic)
    2. Azure Database for PostgreSQL Flexible Server (Burstable B1ms)
    3. Azure Container Apps environment + app (Consumption, scales to zero)

  Deploy with:
    az deployment group create \
      --resource-group <rg> \
      --template-file infra/main.bicep \
      --parameters infra/main.bicepparam
*/

targetScope = 'resourceGroup'

@description('Azure region for all resources. Default: UK South (London).')
param location string = 'uksouth'

@description('Base name used to derive all resource names. Must be lowercase alphanumeric.')
@minLength(3)
@maxLength(20)
param appName string

@description('Docker image to deploy, e.g. myregistry.azurecr.io/communities:sha-abc1234')
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('PostgreSQL admin password.')
@secure()
param dbAdminPassword string

@description('NextAuth AUTH_SECRET — generate with: openssl rand -base64 32')
@secure()
param authSecret string

@description('Set to "true" only in non-production environments.')
param mockAuth string = 'false'

@description('Entra External ID application (client) ID. Leave empty if not using Entra.')
param entraClientId string = ''

@description('Entra External ID client secret.')
@secure()
param entraClientSecret string = ''

@description('Entra External ID issuer URL, e.g. https://<tenant>.ciamlogin.com/<tenant-id>/v2.0')
param entraIssuer string = ''

// ── Modules ────────────────────────────────────────────────────────

module registry 'modules/registry.bicep' = {
  name: 'registry'
  params: {
    location: location
    name: '${replace(appName, '-', '')}cr' // ACR names must be alphanumeric
  }
}

module database 'modules/database.bicep' = {
  name: 'database'
  params: {
    location: location
    serverName: '${appName}-db'
    adminPassword: dbAdminPassword
  }
}

module containerApp 'modules/container-apps.bicep' = {
  name: 'containerApp'
  params: {
    location: location
    appName: appName
    containerImage: containerImage
    registryLoginServer: registry.outputs.loginServer
    registryId: registry.outputs.registryId
    databaseUrl: database.outputs.connectionString
    testDatabaseUrl: database.outputs.testConnectionString
    authSecret: authSecret
    mockAuth: mockAuth
    entraClientId: entraClientId
    entraClientSecret: entraClientSecret
    entraIssuer: entraIssuer
  }
}

// ── Outputs ────────────────────────────────────────────────────────

output appUrl string = containerApp.outputs.appUrl
output registryLoginServer string = registry.outputs.loginServer
output databaseFqdn string = database.outputs.serverFqdn
