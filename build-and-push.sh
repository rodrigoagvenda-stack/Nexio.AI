#!/bin/bash

# Script para fazer build local e push para Easypanel
# Uso: ./build-and-push.sh

set -e

echo "🔨 Fazendo build da imagem Docker localmente..."

# Nome da imagem (ajuste para o registry do seu Easypanel)
IMAGE_NAME="vendai-crm"
REGISTRY="registry.easypanel.io"  # Ajuste conforme seu Easypanel
TAG="latest"

# Build local
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -t "${IMAGE_NAME}:${TAG}" \
  .

echo "✅ Build completado com sucesso!"

# Tag para o registry
echo "🏷️  Criando tag para o registry..."
docker tag "${IMAGE_NAME}:${TAG}" "${REGISTRY}/${IMAGE_NAME}:${TAG}"

# Push para o registry
echo "📤 Fazendo push para o registry..."
docker push "${REGISTRY}/${IMAGE_NAME}:${TAG}"

echo "✅ Push completado! Agora faça deploy no Easypanel."
