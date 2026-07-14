#!/bin/bash
# ============================================================
# infrastructure/user_data.sh
#
# This script runs ONCE automatically when EC2 first boots.
# Terraform calls this via the user_data argument.
#
# It:
#   1. Updates the OS
#   2. Installs Docker + Docker Compose
#   3. Creates the production docker-compose.yml on the server
#   4. Does NOT start the app yet — GitHub Actions does that
#      on first deploy (docker pull + docker-compose up)
# ============================================================

set -e   # Exit on any error
set -x   # Log every command to /var/log/user-data.log

LOG="/var/log/user-data.log"
exec > >(tee -a "$LOG") 2>&1

echo "========================================"
echo "EC2 Bootstrap starting at $(date)"
echo "========================================"

# ── Step 1: Update OS ────────────────────────────────────────
echo "[1/7] Updating OS packages..."
dnf update -y

# ── Step 2: Install Docker ───────────────────────────────────
echo "[2/7] Installing Docker..."
dnf install -y docker

# Start Docker daemon and enable it to start on every reboot
systemctl start docker
systemctl enable docker

# Add ec2-user to docker group so docker commands work without sudo
usermod -aG docker ec2-user

echo "Docker installed: $(docker --version)"

# ── Step 3: Install Docker Compose ───────────────────────────
echo "[3/7] Installing Docker Compose..."
COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | sed 's/.*"tag_name": "\(.*\)".*/\1/')
curl -L "https://github.com/docker/compose/releases/download/$${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

echo "Docker Compose installed: $(docker-compose --version)"

# ── Step 4: Install AWS CLI (for SSM + CloudWatch) ───────────
echo "[4/7] Installing AWS CLI..."
dnf install -y awscli
echo "AWS CLI: $(aws --version)"

# ── Step 5: Create working directory ─────────────────────────
echo "[5/7] Creating app directory..."
mkdir -p /home/ec2-user/app
chown ec2-user:ec2-user /home/ec2-user/app

# ── Step 6: Write docker-compose.prod.yml on the server ──────
echo "[6/7] Writing docker-compose.prod.yml..."
cat > /home/ec2-user/app/docker-compose.prod.yml << 'COMPOSE'
version: '3.8'

services:
  api:
    image: ${dockerhub_username}/travel-planner-api:latest
    container_name: travel-planner-api
    ports:
      - "5000:5000"
    # Load all environment variables from fetched secrets .env file
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      redis:
        condition: service_healthy
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    image: redis:7-alpine
    container_name: travel-planner-redis
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    volumes:
      - redis_data:/data
    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "2"

volumes:
  redis_data:
    driver: local
COMPOSE

chown ec2-user:ec2-user /home/ec2-user/app/docker-compose.prod.yml

# ── Step 7: Create shell script to fetch secrets from AWS SSM ──
echo "[7/8] Creating fetch_secrets.sh..."
cat > /home/ec2-user/app/fetch_secrets.sh << 'FETCH'
#!/bin/bash
# Rebuild the .env file with secrets retrieved from AWS SSM Parameter Store
ENV_FILE="/home/ec2-user/app/.env"
echo "NODE_ENV=production" > $ENV_FILE
echo "REDIS_URL=redis://redis:6379" >> $ENV_FILE
echo "AWS_DEFAULT_REGION=${aws_region}" >> $ENV_FILE

KEYS=(
  "MONGO_URI"
  "JWT_ACCESS_SECRET"
  "JWT_REFRESH_SECRET"
  "JWT_ACCESS_EXPIRES"
  "JWT_REFRESH_EXPIRES"
  "GROQ_API_KEY"
  "GOOGLE_MAPS_API_KEY"
  "HOTELBEDS_API_KEY"
  "HOTELBEDS_API_SECRET"
  "HOTELBEDS_BASE_URL"
  "ACTIVITY_API_KEY"
  "TRANSFERS_API_KEY"
  "GOOGLE_CALENDAR_CLIENT_ID"
  "GOOGLE_CALENDAR_CLIENT_SECRET"
  "GOOGLE_CALENDAR_REDIRECT_URI"
  "AVIATIONSTACK_API_KEY"
  "OPENWEATHER_API_KEY"
  "PORT"
  "CLIENT_URL"
)

for KEY in "$${KEYS[@]}"; do
  VAL=$(aws ssm get-parameter --name "/${project_name}/$${KEY}" --with-decryption --query "Parameter.Value" --output text --region ${aws_region} 2>/dev/null || echo "")
  if [ ! -z "$${VAL}" ]; then
    echo "$${KEY}=$${VAL}" >> $ENV_FILE
  fi
done

chown ec2-user:ec2-user $ENV_FILE
chmod 600 $ENV_FILE
echo "Secrets .env updated successfully"
FETCH

chmod +x /home/ec2-user/app/fetch_secrets.sh
chown ec2-user:ec2-user /home/ec2-user/app/fetch_secrets.sh

# Run once at startup to initial populate .env file
/home/ec2-user/app/fetch_secrets.sh

# ── Step 8: Pull Redis image early ──
echo "[8/8] Pre-pulling Redis image..."
docker pull redis:7-alpine

echo "========================================"
echo "EC2 Bootstrap COMPLETE at $(date)"
echo "GitHub Actions will deploy the API container on first push."
echo "========================================"

