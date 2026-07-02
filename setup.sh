#!/bin/bash

# =============================================================================
#  URS Payroll System — VPS Setup Script
#  Ubuntu 22.04 / 24.04
#  Run this as root: bash setup.sh
# =============================================================================

set -e  # Exit immediately on any error

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Helpers ───────────────────────────────────────────────────────────────────
print_header() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
print_success() { echo -e "${GREEN}  ✔  $1${NC}"; }
print_warning() { echo -e "${YELLOW}  ⚠  $1${NC}"; }
print_error()   { echo -e "${RED}  ✘  $1${NC}"; }
print_info()    { echo -e "     $1"; }

# ── Must be root ──────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  print_error "Please run this script as root: sudo bash setup.sh"
  exit 1
fi

# =============================================================================
#  SECTION 0 — Collect all inputs upfront
# =============================================================================
print_header "URS Payroll — VPS Setup"
echo ""
echo -e "  This script will install and configure:"
echo -e "  Node.js 20, PostgreSQL, Nginx, PM2, Certbot"
echo -e "  and deploy your app from a private GitHub repo."
echo ""
echo -e "${YELLOW}  Answer the prompts below. Nothing will be installed yet.${NC}"
echo ""

# Deploy user
read -p "  Deploy username to create (e.g. deploy): " DEPLOY_USER
DEPLOY_USER=${DEPLOY_USER:-deploy}

# GitHub
read -p "  GitHub username: " GH_USER
read -p "  GitHub repo name (e.g. urs-payroll): " GH_REPO
read -p "  GitHub Personal Access Token (PAT): " GH_TOKEN
APP_DIR="/home/${DEPLOY_USER}/${GH_REPO}"

# Domain
read -p "  Your domain (e.g. yourdomain.com): " DOMAIN

# Database
read -p "  PostgreSQL DB name (e.g. urs_payroll): " DB_NAME
DB_NAME=${DB_NAME:-urs_payroll}
read -p "  PostgreSQL DB user (e.g. urs_admin): " DB_USER
DB_USER=${DB_USER:-urs_admin}
read -s -p "  PostgreSQL DB password: " DB_PASS
echo ""

# Backend port
read -p "  Backend port (default: 5000): " BACKEND_PORT
BACKEND_PORT=${BACKEND_PORT:-5000}

# Email for SSL cert
read -p "  Email for SSL certificate (Let's Encrypt): " SSL_EMAIL

# Confirm before proceeding
echo ""
echo -e "${YELLOW}  ── Summary ──────────────────────────────────${NC}"
echo -e "  Deploy user   : ${DEPLOY_USER}"
echo -e "  GitHub repo   : https://github.com/${GH_USER}/${GH_REPO}"
echo -e "  App directory : ${APP_DIR}"
echo -e "  Domain        : ${DOMAIN}"
echo -e "  Database      : ${DB_NAME} / user: ${DB_USER}"
echo -e "  Backend port  : ${BACKEND_PORT}"
echo -e "  SSL email     : ${SSL_EMAIL}"
echo ""
read -p "  Proceed with setup? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "  Aborted."
  exit 0
fi

# =============================================================================
#  SECTION 1 — System update
# =============================================================================
print_header "Step 1 — Updating system packages"
apt update -y && apt upgrade -y
print_success "System updated"

# =============================================================================
#  SECTION 2 — Create deploy user
# =============================================================================
print_header "Step 2 — Creating deploy user: ${DEPLOY_USER}"

if id "$DEPLOY_USER" &>/dev/null; then
  print_warning "User '${DEPLOY_USER}' already exists — skipping creation"
else
  adduser --gecos "" --disabled-password "$DEPLOY_USER"
  echo "${DEPLOY_USER}:$(openssl rand -base64 16)" | chpasswd
  usermod -aG sudo "$DEPLOY_USER"
  print_success "User '${DEPLOY_USER}' created and added to sudo group"
fi

# =============================================================================
#  SECTION 3 — Firewall
# =============================================================================
print_header "Step 3 — Configuring UFW firewall"

ufw --force reset > /dev/null 2>&1
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
print_success "Firewall configured (OpenSSH + Nginx allowed)"

# =============================================================================
#  SECTION 4 — Install Node.js 20
# =============================================================================
print_header "Step 4 — Installing Node.js 20"

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
print_success "Node.js $(node -v) installed"
print_success "npm $(npm -v) installed"

# =============================================================================
#  SECTION 5 — Install PostgreSQL
# =============================================================================
print_header "Step 5 — Installing PostgreSQL"

apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql
print_success "PostgreSQL installed and running"

# Create DB and user
print_info "Creating database '${DB_NAME}' and user '${DB_USER}'..."
sudo -u postgres psql <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
EOF
print_success "Database and user created"

# =============================================================================
#  SECTION 6 — Install Nginx and PM2
# =============================================================================
print_header "Step 6 — Installing Nginx and PM2"

apt install -y nginx
systemctl enable nginx
print_success "Nginx installed"

npm install -g pm2
print_success "PM2 installed"

# =============================================================================
#  SECTION 7 — Clone GitHub repo
# =============================================================================
print_header "Step 7 — Cloning repository"

# Store credentials temporarily for clone
git config --global credential.helper store
echo "https://${GH_USER}:${GH_TOKEN}@github.com" > /root/.git-credentials

if [ -d "$APP_DIR" ]; then
  print_warning "Directory ${APP_DIR} already exists — pulling latest instead"
  cd "$APP_DIR"
  sudo -u "$DEPLOY_USER" git pull
else
  sudo -u "$DEPLOY_USER" git clone \
    "https://${GH_USER}:${GH_TOKEN}@github.com/${GH_USER}/${GH_REPO}.git" \
    "$APP_DIR"
fi

# Save credentials for the deploy user for future git pulls
sudo -u "$DEPLOY_USER" git config --global credential.helper store
echo "https://${GH_USER}:${GH_TOKEN}@github.com" > /home/${DEPLOY_USER}/.git-credentials
chown "${DEPLOY_USER}:${DEPLOY_USER}" /home/${DEPLOY_USER}/.git-credentials

print_success "Repository cloned to ${APP_DIR}"

# =============================================================================
#  SECTION 8 — Import SQL schema
# =============================================================================
print_header "Step 8 — Importing database schema (index.sql)"

SQL_FILE="${APP_DIR}/backend/index.sql"

if [ -f "$SQL_FILE" ]; then
  sudo -u postgres psql -d "$DB_NAME" -f "$SQL_FILE"
  # Grant permissions on all created tables/sequences
  sudo -u postgres psql -d "$DB_NAME" <<EOF
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
EOF
  print_success "Schema imported and permissions granted"
else
  print_warning "index.sql not found at ${SQL_FILE} — skipping import"
  print_info "You can import it manually later with:"
  print_info "  sudo -u postgres psql -d ${DB_NAME} -f ${SQL_FILE}"
fi

# =============================================================================
#  SECTION 9 — Backend setup
# =============================================================================
print_header "Step 9 — Setting up backend"

BACKEND_DIR="${APP_DIR}/backend/src"
cd "$BACKEND_DIR"

# Install dependencies
sudo -u "$DEPLOY_USER" npm install
print_success "Backend dependencies installed"

# Create .env file
ENV_FILE="${BACKEND_DIR}/.env"
if [ -f "$ENV_FILE" ]; then
  print_warning ".env already exists — skipping creation"
  print_info "Edit manually if needed: nano ${ENV_FILE}"
else
  cat > "$ENV_FILE" <<EOF
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}
PORT=${BACKEND_PORT}
NODE_ENV=production
EOF
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  print_success ".env file created at ${ENV_FILE}"
fi

# Start with PM2
sudo -u "$DEPLOY_USER" pm2 delete urs-backend 2>/dev/null || true
sudo -u "$DEPLOY_USER" pm2 start "${BACKEND_DIR}/server.js" --name urs-backend
sudo -u "$DEPLOY_USER" pm2 save

# Setup PM2 startup
PM2_STARTUP=$(sudo -u "$DEPLOY_USER" pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/${DEPLOY_USER}" | grep "sudo env")
if [ -n "$PM2_STARTUP" ]; then
  eval "$PM2_STARTUP"
fi
print_success "Backend started with PM2"

# =============================================================================
#  SECTION 10 — Frontend build
# =============================================================================
print_header "Step 10 — Building frontend"

FRONTEND_DIR="${APP_DIR}/frontend"
cd "$FRONTEND_DIR"

# Create frontend .env
FRONTEND_ENV="${FRONTEND_DIR}/.env"
if [ ! -f "$FRONTEND_ENV" ]; then
  cat > "$FRONTEND_ENV" <<EOF
VITE_API_URL=https://${DOMAIN}/api
EOF
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "$FRONTEND_ENV"
  print_success "Frontend .env created"
else
  print_warning "Frontend .env already exists — skipping"
fi

sudo -u "$DEPLOY_USER" npm install
sudo -u "$DEPLOY_USER" npm run build
print_success "Frontend built — dist folder ready"

# =============================================================================
#  SECTION 11 — Nginx configuration
# =============================================================================
print_header "Step 11 — Configuring Nginx"

cat > /etc/nginx/sites-available/urs-payroll <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Serve React frontend
    root ${FRONTEND_DIR}/dist;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    # Forward /api requests to Node backend
    location /api/ {
        proxy_pass http://localhost:${BACKEND_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/urs-payroll /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test config
nginx -t
systemctl restart nginx
print_success "Nginx configured and restarted"

# =============================================================================
#  SECTION 12 — SSL with Let's Encrypt
# =============================================================================
print_header "Step 12 — Installing SSL certificate"

apt install -y certbot python3-certbot-nginx

certbot --nginx \
  -d "$DOMAIN" \
  -d "www.${DOMAIN}" \
  --non-interactive \
  --agree-tos \
  --email "$SSL_EMAIL" \
  --redirect

print_success "SSL certificate installed — HTTPS enabled"

# =============================================================================
#  DONE
# =============================================================================
print_header "✔  Setup Complete!"
echo ""
echo -e "  ${GREEN}Your app is live at: https://${DOMAIN}${NC}"
echo ""
echo -e "  ${CYAN}Useful commands:${NC}"
echo -e "  pm2 status                  — check backend status"
echo -e "  pm2 logs urs-backend        — view backend logs"
echo -e "  pm2 restart urs-backend     — restart backend"
echo -e "  sudo nginx -t               — test Nginx config"
echo -e "  sudo systemctl restart nginx — restart Nginx"
echo ""
echo -e "  ${CYAN}To redeploy after a code push:${NC}"
echo -e "  cd ${APP_DIR} && git pull"
echo -e "  cd backend/src && npm install && pm2 restart urs-backend"
echo -e "  cd ../frontend && npm install && npm run build"
echo ""