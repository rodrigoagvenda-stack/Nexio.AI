#!/bin/bash

echo "🚀 Deploying vend.AI..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Pull latest code
echo -e "${YELLOW}📥 Pulling latest code...${NC}"
git pull origin claude/ai-crm-whatsapp-3rbId

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Build
echo -e "${YELLOW}🔨 Building Next.js...${NC}"
npm run build

# Create logs directory if it doesn't exist
mkdir -p logs

# Restart PM2
echo -e "${YELLOW}🔄 Restarting PM2...${NC}"
pm2 restart ecosystem.config.js

# Save PM2 configuration
pm2 save

echo -e "${GREEN}✅ Deploy complete!${NC}"
echo ""
echo "Status:"
pm2 status
