param location string
param appName string

// Storage account names: max 24 chars, lowercase alphanumeric only
var storageName = take(toLower(replace(replace(appName, '-', ''), '_', '')), 18)

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: '${storageName}${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowSharedKeyAccess: false      // enforce key-less / MI-only access
    publicNetworkAccess: 'Disabled'  // private endpoint access only
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
