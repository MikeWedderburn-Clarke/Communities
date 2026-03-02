/*
  Azure Container Registry — Basic tier.
  Used to store the app's Docker image.
*/
param location string
param name string

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false // ACR pull via managed identity, not admin password
  }
}

output registryId string = registry.id
output loginServer string = registry.properties.loginServer
output name string = registry.name
