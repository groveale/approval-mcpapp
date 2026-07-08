param location string
param appName string

// ACR names: max 50 chars, alphanumeric only
var registryName = take(toLower(replace(replace(appName, '-', ''), '_', '')), 42)

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: '${registryName}${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false  // images pulled via Managed Identity
  }
}

output registryName string = acr.name
output loginServer string = acr.properties.loginServer
