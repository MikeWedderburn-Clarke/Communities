/*
  Azure Container Apps environment + app.
  The app uses a system-assigned managed identity to pull images from ACR.
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

// Container Apps environment (consumption plan)
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

// Container App
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: {
    type: 'SystemAssigned'
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
          identity: 'system'
        }
      ]
      secrets: [
        { name: 'database-url', value: databaseUrl }
        { name: 'auth-secret', value: authSecret }
        { name: 'entra-client-secret', value: entraClientSecret }
      ]
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
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'AUTH_SECRET', secretRef: 'auth-secret' }
            { name: 'MOCK_AUTH', value: mockAuth }
            { name: 'AUTH_ENTRA_CLIENT_ID', value: entraClientId }
            { name: 'AUTH_ENTRA_CLIENT_SECRET', secretRef: 'entra-client-secret' }
            { name: 'AUTH_ENTRA_ISSUER', value: entraIssuer }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 10
      }
    }
  }
}

// Grant the Container App's managed identity the AcrPull role on the registry
// Built-in AcrPull role definition ID: 7f951dda-4ed3-4680-a7ca-43fe172d538d
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registryId, app.id, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output appFqdn string = app.properties.configuration.ingress.fqdn
output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output principalId string = app.identity.principalId
