#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Azure Deployment Script
# Builds Docker images and pushes to Azure Container Registry (ACR)
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ── Configuration — update these values ──────────────────────────────────────
ACR_NAME="your-acr-name"                          # e.g. resourceutilityacr
RESOURCE_GROUP="your-resource-group"              # e.g. resource-utility-rg
BACKEND_APP_NAME="resource-utility-backend"       # Azure Web App name for backend
FRONTEND_APP_NAME="resource-utility-frontend"     # Azure Web App name for frontend
IMAGE_TAG="${1:-latest}"                          # Pass tag as arg, default: latest

BACKEND_IMAGE="${ACR_NAME}.azurecr.io/resource-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="${ACR_NAME}.azurecr.io/resource-frontend:${IMAGE_TAG}"

echo "🔐 Logging in to Azure Container Registry: ${ACR_NAME}"
az acr login --name "${ACR_NAME}"

echo "🏗️  Building backend image..."
docker build -t "${BACKEND_IMAGE}" ./backend

echo "🏗️  Building frontend image..."
docker build -t "${FRONTEND_IMAGE}" ./frontend

echo "📤 Pushing backend image..."
docker push "${BACKEND_IMAGE}"

echo "📤 Pushing frontend image..."
docker push "${FRONTEND_IMAGE}"

echo "🚀 Updating backend Web App..."
az webapp config container set \
  --name "${BACKEND_APP_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --container-image-name "${BACKEND_IMAGE}" \
  --container-registry-url "https://${ACR_NAME}.azurecr.io"

echo "🚀 Updating frontend Web App..."
az webapp config container set \
  --name "${FRONTEND_APP_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --container-image-name "${FRONTEND_IMAGE}" \
  --container-registry-url "https://${ACR_NAME}.azurecr.io"

echo "✅ Deployment complete!"
echo "   Backend:  https://${BACKEND_APP_NAME}.azurewebsites.net"
echo "   Frontend: https://${FRONTEND_APP_NAME}.azurewebsites.net"
