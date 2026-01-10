# 🚀 Deploy na VPS - Sistema de Gestão para Igrejas

Este guia completo mostra como fazer deploy do sistema na sua VPS usando Docker.

## 📋 Pré-requisitos

- VPS com Ubuntu 20.04+ ou Debian 11+
- Docker e Docker Compose instalados
- Domínio configurado apontando para sua VPS
- Acesso SSH root ou sudo

## 🛠️ 1. Preparar o Servidor

### 1.1. Instalar Docker

```bash
# Atualizar pacotes
sudo apt update && sudo apt upgrade -y

# Instalar dependências
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Adicionar repositório Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER
newgrp docker
```

### 1.2. Instalar Docker Compose

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

## 📦 2. Estrutura de Pastas

```bash
mkdir -p /opt/igreja
cd /opt/igreja

# Criar estrutura
mkdir -p {app,nginx,supabase,n8n,storage}
```

## 🐳 3. Docker Compose

Crie o arquivo `/opt/igreja/docker-compose.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL (Supabase)
  postgres:
    image: supabase/postgres:15.1.0.117
    container_name: igreja_postgres
    restart: always
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: igreja_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./supabase/migrations:/docker-entrypoint-initdb.d
    networks:
      - igreja_network

  # Supabase Studio
  supabase_studio:
    image: supabase/studio:20231123-64a766a
    container_name: igreja_supabase_studio
    restart: always
    ports:
      - "3001:3000"
    environment:
      SUPABASE_URL: http://kong:8000
      STUDIO_PG_META_URL: http://postgres:5432
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    depends_on:
      - postgres
    networks:
      - igreja_network

  # Supabase Kong (API Gateway)
  kong:
    image: kong:2.8.1
    container_name: igreja_kong
    restart: always
    ports:
      - "8000:8000"
      - "8443:8443"
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: postgres
      KONG_PG_USER: supabase_admin
      KONG_PG_PASSWORD: ${POSTGRES_PASSWORD}
      KONG_PG_DATABASE: igreja_db
    depends_on:
      - postgres
    networks:
      - igreja_network

  # Next.js App
  app:
    build:
      context: ./app
      dockerfile: Dockerfile
    container_name: igreja_app
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/igreja_db
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - N8N_WEBHOOK_URL_BASE=${N8N_WEBHOOK_URL_BASE}
      - N8N_WEBHOOK_SECRET=${N8N_WEBHOOK_SECRET}
      - WHATSAPP_API_URL=${WHATSAPP_API_URL}
      - WHATSAPP_API_TOKEN=${WHATSAPP_API_TOKEN}
    depends_on:
      - postgres
    volumes:
      - ./storage:/app/storage
    networks:
      - igreja_network

  # Nginx (Proxy Reverso)
  nginx:
    image: nginx:alpine
    container_name: igreja_nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - app
      - supabase_studio
    networks:
      - igreja_network

networks:
  igreja_network:
    driver: bridge

volumes:
  postgres_data:
```

## 🔐 4. Variáveis de Ambiente

Crie `/opt/igreja/.env`:

```bash
# Database
POSTGRES_PASSWORD=sua_senha_super_segura_aqui

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://supabase.seudominio.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_aqui

# n8n Webhooks
N8N_WEBHOOK_URL_BASE=https://n8n.seudominio.com
N8N_ESCALA_CONFIRMACAO_WEBHOOK=/webhook/escala-confirmacao
N8N_ENVIAR_PDF_WEBHOOK=/webhook/enviar-pdf
N8N_NOTIFICACOES_WEBHOOK=/webhook/notificacoes
N8N_WEBHOOK_SECRET=gerar_string_aleatoria_longa_aqui

# WhatsApp API
WHATSAPP_API_URL=https://api.uazapi.com
WHATSAPP_API_TOKEN=seu_token_whatsapp

# App
NEXT_PUBLIC_APP_URL=https://igreja.seudominio.com
NODE_ENV=production
STORAGE_BUCKET=igreja-arquivos
```

## 🌐 5. Configurar Nginx

Crie `/opt/igreja/nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logs
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    # App Principal
    server {
        listen 80;
        server_name igreja.seudominio.com;

        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name igreja.seudominio.com;

        ssl_certificate /etc/letsencrypt/live/igreja.seudominio.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/igreja.seudominio.com/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        client_max_body_size 50M;

        location / {
            proxy_pass http://app:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }

    # Supabase Studio
    server {
        listen 443 ssl http2;
        server_name supabase.seudominio.com;

        ssl_certificate /etc/letsencrypt/live/supabase.seudominio.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/supabase.seudominio.com/privkey.pem;

        location / {
            proxy_pass http://supabase_studio:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }

    # Supabase API
    server {
        listen 443 ssl http2;
        server_name api.seudominio.com;

        ssl_certificate /etc/letsencrypt/live/api.seudominio.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/api.seudominio.com/privkey.pem;

        location / {
            limit_req zone=api_limit burst=20 nodelay;

            proxy_pass http://kong:8000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

## 🔒 6. Configurar SSL (Let's Encrypt)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Gerar certificados
sudo certbot certonly --standalone -d igreja.seudominio.com
sudo certbot certonly --standalone -d supabase.seudominio.com
sudo certbot certonly --standalone -d api.seudominio.com

# Auto-renovação
sudo crontab -e
# Adicionar:
0 0 1 * * certbot renew --quiet && docker-compose -f /opt/igreja/docker-compose.yml restart nginx
```

## 🏗️ 7. Dockerfile do App

Crie `/opt/igreja/app/Dockerfile`:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

## 🚀 8. Deploy

```bash
cd /opt/igreja

# Clonar repositório
git clone <seu-repo> app
cd app

# Copiar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com suas configurações

# Build e iniciar
cd /opt/igreja
docker-compose up -d --build

# Ver logs
docker-compose logs -f app

# Verificar status
docker-compose ps
```

## 🗄️ 9. Aplicar Migrations do Supabase

```bash
# Copiar arquivos SQL
docker cp ./supabase/migrations/00_initial_schema.sql igreja_postgres:/tmp/
docker cp ./supabase/migrations/01_rls_policies.sql igreja_postgres:/tmp/
docker cp ./supabase/migrations/02_functions.sql igreja_postgres:/tmp/

# Executar migrations
docker exec -it igreja_postgres psql -U postgres -d igreja_db -f /tmp/00_initial_schema.sql
docker exec -it igreja_postgres psql -U postgres -d igreja_db -f /tmp/01_rls_policies.sql
docker exec -it igreja_postgres psql -U postgres -d igreja_db -f /tmp/02_functions.sql
```

## 🔧 10. Manutenção

### Atualizar aplicação

```bash
cd /opt/igreja/app
git pull origin main
cd /opt/igreja
docker-compose up -d --build app
```

### Backup do banco

```bash
docker exec igreja_postgres pg_dump -U postgres igreja_db > backup_$(date +%Y%m%d).sql
```

### Restaurar backup

```bash
docker exec -i igreja_postgres psql -U postgres igreja_db < backup_20260110.sql
```

### Ver logs

```bash
# Todos os serviços
docker-compose logs -f

# Apenas app
docker-compose logs -f app

# Apenas postgres
docker-compose logs -f postgres
```

## 📊 11. Monitoramento

### Instalar Portainer (Opcional)

```bash
docker volume create portainer_data
docker run -d -p 9000:9000 --name=portainer --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce
```

Acesse: `https://seudominio.com:9000`

## 🔐 12. Segurança

### Firewall

```bash
# Instalar UFW
sudo apt install -y ufw

# Configurar
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Fail2Ban

```bash
# Instalar
sudo apt install -y fail2ban

# Configurar
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## ✅ 13. Verificação Final

Após deploy, verifique:

- [ ] App acessível em `https://igreja.seudominio.com`
- [ ] Supabase Studio em `https://supabase.seudominio.com`
- [ ] SSL funcionando (cadeado verde)
- [ ] Login funcionando
- [ ] API endpoints respondendo
- [ ] Webhooks n8n configurados
- [ ] Backup automático configurado

## 🆘 Troubleshooting

### App não inicia

```bash
docker-compose logs app
# Verificar variáveis de ambiente
docker-compose exec app env | grep NEXT_PUBLIC
```

### Erro de conexão com banco

```bash
docker-compose exec postgres psql -U postgres -c "SELECT 1;"
docker-compose restart postgres
```

### SSL não funciona

```bash
sudo certbot certificates
sudo systemctl status nginx
```

---

**Pronto!** Seu sistema está no ar! 🎉
