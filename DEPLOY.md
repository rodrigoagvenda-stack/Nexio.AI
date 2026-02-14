# Deploy VPS

## Setup PM2
```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Update
```bash
git pull
npm install
npm run build
pm2 reload nexio-crm
```
