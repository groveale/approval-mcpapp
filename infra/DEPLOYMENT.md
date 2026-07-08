# Deployment Guide

This guide documents the successful deployment of the Access Request & Approval MCP Server to Azure Container Apps.

## Prerequisites

- Azure CLI (`az`) installed and authenticated
- A resource group created in Azure
- Source code with:
  - `Dockerfile` (single-stage, no multi-stage copy issues)
  - `.dockerignore` (excludes only `node_modules`, `dist`, `.azurite`, `.gitignore`, `*.md`, `fixtures`)
  - `tsconfig.server.json` with `emitDeclarationOnly: false` (removed the declaration-only flag)
  - Bicep templates in `infra/` directory

## Deployment Steps

### 1. Deploy Infrastructure (Storage, ACR, Container Apps Environment)

```bash
az deployment group create --resource-group copilot-requests-mcp-agent --template-file infra/main.bicep --parameters infra/main.bicepparam
```

This creates:
- Azure Storage Account (Tables only, Managed Identity access)
- Azure Container Registry (Basic SKU)
- Container Apps Environment
- System-assigned Managed Identity on the Container App
- Role assignments (AcrPull for the app's MI on ACR)

**Expected output:** Resource IDs and FQDN for the Container App.

### 2. Build and Push Docker Image to ACR

```bash
$ACR_LOGINSERVER = (az acr list --resource-group copilot-requests-mcp-agent --query "[0].loginServer" -o tsv); az acr build --registry $ACR_LOGINSERVER --image approval-mcp:v6 .
```

This runs:
1. `npm ci` — install dependencies
2. `npm run build` — compile TypeScript and build UI (Vite)
3. Docker image created in ACR

**Expected output:** Image pushed to ACR. Tag shows in `az acr repository show-tags --name <registry> --repository approval-mcp`.

### 3. Deploy Container App with Image

```bash
az deployment group create --resource-group copilot-requests-mcp-agent --template-file infra/main.bicep --parameters infra/main.bicepparam appName=approval-mcp containerImage=approval-mcp containerTag=v6
```

This redeploys the Bicep template with:
- `containerImage=approval-mcp` (ACR format, no registry domain)
- `containerTag=v6` (the tag from step 2)

The Bicep template automatically:
- Detects ACR format (no `.` in image name)
- Constructs full image URI: `<loginServer>/approval-mcp:v6`
- Configures `identity: 'system'` for MI-based ACR pull

### 4. Verify Deployment

Check Container App status and logs:

```bash
az containerapp logs show --name approval-mcp --resource-group copilot-requests-mcp-agent --follow
```

**Expected output:**
```
🚀 Access Request & Approval MCP Server listening on http://localhost:3001/mcp
```

Test the MCP endpoint:

```bash
$FQDN = (az containerapp show --name approval-mcp --resource-group copilot-requests-mcp-agent --query "properties.configuration.ingress.fqdn" -o tsv); curl -X POST https://$FQDN/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'
```

### 5. Seed Test Data (Optional)

Populate the Storage Account tables with test requests:

```bash
$STORAGE_ACCOUNT = (az storage account list --resource-group copilot-requests-mcp-agent --query "[0].name" -o tsv); $env:AZURE_STORAGE_ACCOUNT_NAME = $STORAGE_ACCOUNT; npm run seed
```

This creates sample `AccessRequest` records (REQ-001, REQ-002, etc.) in the `AccessRequests` table, which you can then query via the MCP tools.

## Key Configuration

| Component | Setting |
|-----------|---------|
| **Image** | `approval-mcp:v6` in ACR |
| **Port** | 3001 |
| **Auth (Storage)** | Managed Identity + Storage Table Data Contributor role |
| **Auth (ACR)** | Managed Identity + AcrPull role |
| **Env Vars** | `AZURE_STORAGE_ACCOUNT_NAME`, `PORT=3001`, `NODE_ENV=production` |
| **Scale** | Min replicas: 0 (scales to zero), Max: 3 |

## Troubleshooting

### Container fails to start: "Cannot find module '/app/dist/main.js'"

**Cause:** `tsconfig.server.json` had `emitDeclarationOnly: true`, so no `.js` files were emitted.

**Fix:** Remove `emitDeclarationOnly` from `tsconfig.server.json` and rebuild:

```bash
npm run build
az acr build --registry $ACR_LOGINSERVER --image approval-mcp:v7 .
az deployment group create --resource-group copilot-requests-mcp-agent --template-file infra/main.bicep --parameters infra/main.bicepparam appName=approval-mcp containerImage=approval-mcp containerTag=v7
```

### ACR image pull fails: "UNAUTHORIZED: authentication required"

**Cause:** Container App MI doesn't have AcrPull role.

**Fix:** The Bicep template assigns it automatically. Redeploy:

```bash
az deployment group create --resource-group copilot-requests-mcp-agent --template-file infra/main.bicep --parameters infra/main.bicepparam
```

### Docker build fails in ACR

**Cause:** `.dockerignore` excluded build files (`src`, `ui`, `tsconfig.json`, etc.).

**Fix:** Keep `.dockerignore` minimal:

```
node_modules
dist
.azurite
.gitignore
*.md
fixtures
```

## Updating the Deployment

To update the running container app with a new image:

1. **Make code changes** in the repository
2. **Build and push new image:**
   ```bash
   $ACR_LOGINSERVER = (az acr list --resource-group copilot-requests-mcp-agent --query "[0].loginServer" -o tsv); az acr build --registry $ACR_LOGINSERVER --image approval-mcp:v7 .
   ```
3. **Update Container App:**
   ```bash
   az deployment group create --resource-group copilot-requests-mcp-agent --template-file infra/main.bicep --parameters infra/main.bicepparam appName=approval-mcp containerImage=approval-mcp containerTag=v7
   ```
4. **Verify:**
   ```bash
   az containerapp logs show --name approval-mcp --resource-group copilot-requests-mcp-agent --follow
   ```

## Storage Configuration

The MCP server connects to Azure Table Storage using **Managed Identity**:

- **Endpoint:** `https://<storageAccountName>.table.core.windows.net`
- **Auth:** `DefaultAzureCredential()` (uses Container App's system-assigned MI)
- **Role:** `Storage Table Data Contributor` on the Storage Account
- **Tables:** `AccessRequests`, `Counters`

The server falls back to **Azurite** (local development) if `AZURE_STORAGE_ACCOUNT_NAME` is not set.

## Summary

The deployment is fully automated via Bicep. The only manual steps are:
1. Initial infrastructure deployment
2. Build and push image per code change
3. Redeploy Container App with new image tag

All three steps can be combined into a CI/CD pipeline for fully automated deployments.
