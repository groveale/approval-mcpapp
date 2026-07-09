param(
  [Parameter(Mandatory = $true)]
  [string]$ResourceGroup,

  [Parameter(Mandatory = $false)]
  [string]$Location = "northeurope",

  [Parameter(Mandatory = $false)]
  [string]$AppName = "approval-mcp",

  [Parameter(Mandatory = $false)]
  [string]$ImageName = "approval-mcp",

  [Parameter(Mandatory = $false)]
  [string]$ImageTag = "v1",

  [Parameter(Mandatory = $false)]
  [string]$TemplateFile = "infra/main.bicep",

  [Parameter(Mandatory = $false)]
  [string]$ParametersFile = "infra/main.bicepparam"
)

$ErrorActionPreference = "Stop"

function Invoke-Az {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args,
    [switch]$CaptureOutput
  )

  if ($CaptureOutput) {
    $result = & az @Args
    if ($LASTEXITCODE -ne 0) {
      throw "Azure CLI command failed: az $($Args -join ' ')"
    }
    return $result
  }

  & az @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI command failed: az $($Args -join ' ')"
  }
}

Write-Host "Step 1/4: Creating or updating resource group '$ResourceGroup' in '$Location'..."
Invoke-Az -Args @('group', 'create', '--name', $ResourceGroup, '--location', $Location) | Out-Null

Write-Host "Step 2/4: Deploying base infrastructure (without container app image)..."
Invoke-Az -Args @(
  'deployment', 'group', 'create',
  '--resource-group', $ResourceGroup,
  '--template-file', $TemplateFile,
  '--parameters', $ParametersFile, "appName=$AppName", 'deployContainerApp=false'
) | Out-Null

$acrName = (Invoke-Az -Args @('acr', 'list', '--resource-group', $ResourceGroup, '--query', '[0].name', '-o', 'tsv') -CaptureOutput).Trim()
if (-not $acrName) {
  throw "No Azure Container Registry found in resource group '$ResourceGroup'."
}

Write-Host "Step 3/4: Building and pushing image '$ImageName`:$ImageTag' to ACR '$acrName'..."
Invoke-Az -Args @('acr', 'build', '--registry', $acrName, '--image', "$ImageName`:$ImageTag", '.')

Write-Host "Step 3.5/4: Ensuring AcrPull role is present for Container App identity..."
$appPrincipal = ''
try {
  $appPrincipal = (Invoke-Az -Args @('containerapp', 'show', '--name', $AppName, '--resource-group', $ResourceGroup, '--query', 'identity.principalId', '-o', 'tsv') -CaptureOutput).Trim()
}
catch {
  # First deployment path: container app may not exist yet.
  $appPrincipal = ''
}

if (-not $appPrincipal) {
  Write-Host "Container App identity not found yet. Bootstrapping app identity with public image..."
  Invoke-Az -Args @(
    'deployment', 'group', 'create',
    '--resource-group', $ResourceGroup,
    '--template-file', $TemplateFile,
    '--parameters', $ParametersFile, "appName=$AppName", 'containerImage=mcr.microsoft.com/hello-world', 'containerTag=latest', 'deployContainerApp=true'
  ) | Out-Null

  $appPrincipal = (Invoke-Az -Args @('containerapp', 'show', '--name', $AppName, '--resource-group', $ResourceGroup, '--query', 'identity.principalId', '-o', 'tsv') -CaptureOutput).Trim()
}

$acrId = (Invoke-Az -Args @('acr', 'show', '--name', $acrName, '--resource-group', $ResourceGroup, '--query', 'id', '-o', 'tsv') -CaptureOutput).Trim()
$existingAcrPull = (Invoke-Az -Args @(
  'role', 'assignment', 'list',
  '--scope', $acrId,
  '--assignee-object-id', $appPrincipal,
  '--query', "[?roleDefinitionName=='AcrPull'] | length(@)",
  '-o', 'tsv'
) -CaptureOutput).Trim()

if (-not $existingAcrPull -or [int]$existingAcrPull -eq 0) {
  Write-Host "Granting AcrPull on ACR to app principal $appPrincipal..."
  Invoke-Az -Args @(
    'role', 'assignment', 'create',
    '--scope', $acrId,
    '--assignee-object-id', $appPrincipal,
    '--assignee-principal-type', 'ServicePrincipal',
    '--role', 'AcrPull'
  ) | Out-Null
}
else {
  Write-Host "AcrPull already exists for app principal."
}

Write-Host "Step 4/4: Deploying container app with image '$ImageName`:$ImageTag'..."
Invoke-Az -Args @(
  'deployment', 'group', 'create',
  '--resource-group', $ResourceGroup,
  '--template-file', $TemplateFile,
  '--parameters', $ParametersFile, "appName=$AppName", "containerImage=$ImageName", "containerTag=$ImageTag", 'deployContainerApp=true'
) | Out-Null

$fqdn = (Invoke-Az -Args @('containerapp', 'show', '--name', $AppName, '--resource-group', $ResourceGroup, '--query', 'properties.configuration.ingress.fqdn', '-o', 'tsv') -CaptureOutput).Trim()

Write-Host "Done."
if ($fqdn) {
  Write-Host "MCP endpoint: https://$fqdn/mcp"
}