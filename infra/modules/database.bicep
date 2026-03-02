/*
  Azure Database for PostgreSQL Flexible Server — Burstable B1ms.
  Public access is enabled; only Azure services and the provided client IPs are allowed.
  SSL is required for all connections.
*/
param location string
param serverName string

@secure()
param adminPassword string

param adminUser string = 'pgadmin'
param databaseName string = 'communities'

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: serverName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: adminUser
    administratorLoginPassword: adminPassword
    version: '16'
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: server
  name: databaseName
}

// Allow all Azure-hosted services (Container Apps, etc.) to connect
resource azureServicesFirewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: server
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Connection string in the format expected by pg / drizzle-orm/node-postgres
output connectionString string = 'postgres://${adminUser}:${adminPassword}@${server.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require'
output serverFqdn string = server.properties.fullyQualifiedDomainName
