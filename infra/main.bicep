targetScope = 'resourceGroup'

param location string = resourceGroup().location

@description('Short name used to derive all resource names.')
param appName string = 'approval-mcp'

@description('Container image name in ACR (without tag).')
param containerImage string = 'approval-mcp'

@description('Container image tag to deploy.')
param containerTag string = 'latest'

@description('Set false to deploy base infra only (network/storage/acr) without the container app.')
param deployContainerApp bool = true

// ── Storage Account ──────────────────────────────────────────────────
module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    appName: appName
  }
}

// ── Container Registry ───────────────────────────────────────────────
module registry 'modules/registry.bicep' = {
  name: 'registry'
  params: {
    location: location
    appName: appName
  }
}

// ── Container App ─────────────────────────────────────────────────────
module containerApp 'modules/container-app.bicep' = if (deployContainerApp) {
  name: 'containerApp'
  params: {
    location: location
    appName: appName
    registryName: registry.outputs.registryName
    storageAccountName: storage.outputs.storageAccountName
    containerImage: containerImage
    containerTag: containerTag
  }
}

// ── Storage Table Data Contributor role for the Container App MI ─────
module tableRole 'modules/role-assignment.bicep' = if (deployContainerApp) {
  name: 'tableRole'
  params: {
    storageAccountName: storage.outputs.storageAccountName
    principalId: containerApp!.outputs.principalId
  }
}

// ── Outputs ──────────────────────────────────────────────────────────
output mcpEndpoint string = deployContainerApp ? 'https://${containerApp!.outputs.fqdn}/mcp' : ''
output publicMcpEndpoint string = deployContainerApp ? 'https://${containerApp!.outputs.fqdn}/mcp' : ''
output registryLoginServer string = registry.outputs.loginServer
output storageAccountName string = storage.outputs.storageAccountName
