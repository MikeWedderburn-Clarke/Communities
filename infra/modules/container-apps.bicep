/*
  Azure Container Apps environment + app.
  Uses a user-assigned managed identity for ACR pull so the role assignment
  is created BEFORE the container app — eliminating the race condition that
  causes "Operation expired" with system-assigned identity.
  Ingress is HTTPS-only on port 3000. Min replicas = 0 (scales to zero).
*/
param location string
param appName string
param containerImage string
param registryLoginServer string
param registryId string

@secure()
param databaseUrl string

@secure()
param authSecret string

param mockAuth string = 'false'
param entraClientId string = ''

@secure()
param entraClientSecret string = ''

param entraIssuer string = ''

var hasEntra = !empty(entraClientSecret)

var entraSecrets = hasEntra ? [
  { name: 'entra-client-secret', value: entraClientSecret }
] : []

var entraEnv = hasEntra ? [
  { name: 'AUTH_ENTRA_CLIENT_SECRET', secretRef: 'entra-client-secret' }
] : []

// ── User-assigned managed identity ────────────────────────────────────────────
// Created first so AcrPull can be assigned before the container app exists,
// eliminating the race condition with system-assigned identity.
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${appName}-identity'
  location: location
}

// Grant AcrPull to the identity BEFORE the container app is created.
// Built-in AcrPull role definition ID: 7f951dda-4ed3-4680-a7ca-43fe172d538d
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registryId, identity.id, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Container Apps environment (consumption plan) ─────────────────────────────
resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${appName}-env'
  location: location
  properties: {
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// ── Container App ─────────────────────────────────────────────────────────────
// dependsOn acrPullRole ensures the role is propagated before the app starts
// its first revision — avoiding the "Operation expired" provisioning error.
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  dependsOn: [acrPullRole]
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: registryLoginServer
          identity: identity.id
        }
      ]
      secrets: concat([
        { name: 'database-url', value: databaseUrl }
        { name: 'auth-secret', value: authSecret }
      ], entraSecrets)
    }
    template: {
      containers: [
        {
          name: appName
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: concat([
            { name: 'NODE_ENV', value: 'production' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'AUTH_SECRET', secretRef: 'auth-secret' }
            { name: 'MOCK_AUTH', value: mockAuth }
            { name: 'AUTH_ENTRA_CLIENT_ID', value: entraClientId }
            { name: 'AUTH_ENTRA_ISSUER', value: entraIssuer }
          ], entraEnv)
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 10
      }
    }
  }
}

output appFqdn string = app.properties.configuration.ingress.fqdn
output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output principalId string = identity.properties.principalId
