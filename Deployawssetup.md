# Steps 3.3–3.6 — AWS Deployment Plan (No Local Docker)

> **Your situation**: No Docker installed locally. You will use the **AWS EC2 server** to run Docker containers. GitHub Actions will build and push Docker images using its own Ubuntu runner (Actions has Docker built in — you don't need it locally at all).

---

## 🗺️ Overview — What Steps 3.3–3.6 Actually Do

| Step | What | Your Approach |
|---|---|---|
| **3.3** | Docker setup (Dockerfiles + compose) | ✅ Just create the files — no local build needed |
| **3.4** | Terraform Infrastructure (EC2 + S3 + CloudFront) | ✅ Terraform runs from your PC (no Docker needed) |
| **3.5** | GitHub Actions CI/CD | ✅ Actions runner builds Docker — not your PC |
| **3.6** | Deployment commands | ✅ Adapted to skip local Docker steps |

---

## ⚠️ AWS Free Tier — How to Stay Within Limits

### What's Free (12 months from account creation)

| Service | Free Tier Limit | Your Usage | Safe? |
|---|---|---|---|
| **EC2 t2.micro** | 750 hrs/month | 1 instance × 24h = 744 hrs/month | ✅ Barely safe — only run 1 instance |
| **S3** | 5 GB storage + 20,000 GET + 2,000 PUT requests | React build ~5MB | ✅ Fine |
| **CloudFront** | 1 TB data out + 10M HTTP requests | Low traffic app | ✅ Fine |
| **Data Transfer** | 15 GB/month out of EC2 | API responses | ✅ Fine for demos |
| **Elastic IP** | FREE while attached to running instance | 1 EIP | ✅ Free |
| **CloudWatch** | 10 custom metrics, 5 GB log ingestion | Basic logging | ✅ Fine |

### ❌ What Will COST You (Avoid These)

| Trap | Solution |
|---|---|
| Running **2 EC2 instances** (exceeds 750hrs) | Use only **1 t2.micro** |
| **Elastic IP not attached** to a running instance | Always delete EIP if you stop instance permanently |
| **NAT Gateway** (not on free tier) | Don't add a NAT gateway |
| **RDS** (not free after first year) | You're using MongoDB Atlas → safe |
| CloudFront with **custom SSL cert** from ACM | Use default CloudFront cert → free |
| Leaving **CloudFront distribution enabled** with heavy traffic | Only share with evaluators |

### ✅ Cost Protection — Set a Billing Alert (Do This First!)

```
AWS Console → Billing → Budgets → Create Budget
→ Cost budget → $1/month
→ Alert at 80% → Enter your email
```
**You will get an email if any charge approaches $1.** This saves you from surprise bills.

---

## 📋 Manual AWS Setup — Step by Step (Cloud Best Practices)

### PHASE 1 — Secure Your AWS Account (Before Anything Else)

#### Step A — Enable MFA on Root Account
```
AWS Console (root login) → My Account → Security credentials
→ Activate MFA → Virtual MFA device → Use Google Authenticator app
→ Scan QR code → Enter 2 MFA codes → Done
```
> **Why**: Root account has unlimited power. MFA prevents unauthorized access even if password is stolen.

#### Step B — Create an IAM User (Don't Use Root for Daily Work)
```
AWS Console → IAM → Users → Add User
  User name: travel-planner-deploy
  Access type: ✅ Programmatic access + ✅ AWS Console access

Attach policies directly:
  ✅ AmazonEC2FullAccess
  ✅ AmazonS3FullAccess
  ✅ CloudFrontFullAccess
  ✅ AmazonSSMFullAccess
  ✅ CloudWatchLogsFullAccess

Download the CSV → Save safely (this is your ACCESS KEY + SECRET KEY)
```
> **Why**: Never use root credentials in code or CI/CD. IAM user with least-privilege is a cloud security best practice.

#### Step C — Store Secrets in AWS SSM Parameter Store (NOT in .env files on server)
```
AWS Console → Systems Manager → Parameter Store → Create parameter

Create these one by one:
  /travel-planner/MONGO_URI          → SecureString → paste your Atlas URI
  /travel-planner/GROQ_API_KEY       → SecureString → paste your key
  /travel-planner/JWT_ACCESS_SECRET  → SecureString → paste your secret
  /travel-planner/JWT_REFRESH_SECRET → SecureString → paste your secret
  /travel-planner/GOOGLE_MAPS_KEY    → SecureString → paste your key
```
> **Why**: SecureString uses AWS KMS encryption. Secrets never touch your code or EC2 disk as plaintext. This is the AWS best practice for secrets management.

---

### PHASE 2 — Create EC2 Key Pair (SSH Access)

```
AWS Console → EC2 → Key Pairs → Create key pair
  Name: travel-planner-key
  Type: RSA
  Format: .pem (for Linux/Mac) or .ppk (for PuTTY on Windows)
  → Create

Save the .pem file → Move to a safe folder (e.g., C:\Users\PRASAD\.ssh\)
```

> **On Windows**, set file permissions so SSH accepts it:
```powershell
# In PowerShell (run as admin) — restrict .pem file permissions
icacls "C:\Users\PRASAD\.ssh\travel-planner-key.pem" /inheritance:r /grant:r "$($env:USERNAME):(R)"
```

---

### PHASE 3 — Create Security Group (Firewall Rules)

```
AWS Console → EC2 → Security Groups → Create security group
  Name: travel-planner-sg
  Description: Security group for travel planner API server
  VPC: default VPC

Inbound rules — Add these:
  Type: SSH       | Port: 22   | Source: My IP    (NOT 0.0.0.0/0 — restrict to your IP only!)
  Type: HTTP      | Port: 80   | Source: Anywhere (0.0.0.0/0)
  Type: Custom TCP| Port: 5000 | Source: Anywhere (0.0.0.0/0) [API port]

Outbound rules: Leave default (All traffic allowed out)
```

> **Cloud Best Practice**: SSH should NEVER be open to 0.0.0.0/0 in production. Use "My IP" so only you can SSH in.

---

### PHASE 4 — Launch EC2 Instance

```
AWS Console → EC2 → Instances → Launch instance

  Name: travel-planner-api
  
  AMI (OS): Amazon Linux 2023 AMI ← Search this, pick the FREE TIER ELIGIBLE one
  
  Instance type: t2.micro ← MUST be this for free tier
  
  Key pair: travel-planner-key (the one you created above)
  
  Network settings:
    VPC: default
    Subnet: any (pick first one)
    Auto-assign public IP: ENABLE ✅
    Security group: Select existing → travel-planner-sg
  
  Storage: 8 GB gp3 (default — free tier gives 30 GB but 8 is enough)
  
  Advanced details → IAM instance profile:
    (We'll create this in Step 5 — skip for now, come back and modify)
  
→ Launch instance
```

---

### PHASE 5 — Create IAM Role for EC2 (So EC2 Can Read SSM Secrets)

```
AWS Console → IAM → Roles → Create role
  Trusted entity: AWS service → EC2
  
  Attach policies:
    ✅ AmazonSSMReadOnlyAccess
    ✅ CloudWatchAgentServerPolicy
  
  Role name: travel-planner-ec2-role
  → Create role

Now attach it to your EC2:
  EC2 → Instances → Select your instance
  → Actions → Security → Modify IAM role
  → Select: travel-planner-ec2-role → Update IAM role
```

> **Why**: Your Node.js app on EC2 will call SSM to load secrets at startup. The IAM role grants permission without needing to paste secrets on the server.

---

### PHASE 6 — SSH Into EC2 and Install Node.js + Docker

```powershell
# On your Windows PC — open PowerShell
# SSH into your EC2 instance
ssh -i "C:\Users\PRASAD\.ssh\travel-planner-key.pem" ec2-user@YOUR_EC2_PUBLIC_IP
```

Once connected (you'll see `[ec2-user@ip-xxx ~]$`), run these commands:

```bash
# Update all packages
sudo dnf update -y

# Install Docker (the EC2 server will run Docker — not your PC!)
sudo dnf install docker -y
sudo systemctl start docker
sudo systemctl enable docker          # Start Docker on every reboot
sudo usermod -aG docker ec2-user      # Allow ec2-user to run docker without sudo

# Exit and reconnect for group change to take effect
exit
```

```powershell
# Reconnect
ssh -i "C:\Users\PRASAD\.ssh\travel-planner-key.pem" ec2-user@YOUR_EC2_PUBLIC_IP
```

```bash
# Verify Docker works
docker --version   # Should print Docker version

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version   # Should print version

# Install Node.js 20 (for running npm commands if needed)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node --version    # Should print v20.x.x

# Install AWS CLI (helps with SSM parameter retrieval)
sudo dnf install -y awscli
aws --version
```

---

### PHASE 7 — Create an Elastic IP (Fixed Public IP)

```
AWS Console → EC2 → Elastic IPs → Allocate Elastic IP address
  → Allocate

Select the new EIP → Actions → Associate Elastic IP address
  Resource type: Instance
  Instance: travel-planner-api (your EC2)
  → Associate
```

> **Why**: Without Elastic IP, your EC2 public IP changes every time you restart it. A fixed IP is needed so GitHub Actions always knows where to SSH/deploy.

> **Cost**: Free ONLY while associated with a running instance. If you stop the instance without releasing the EIP, you'll be charged ~$0.005/hr.

---

### PHASE 8 — Create S3 Bucket for Frontend

```
AWS Console → S3 → Create bucket

  Bucket name: travel-planner-frontend-YOUR_NAME  (must be globally unique)
  Region: us-east-1
  
  Object Ownership: ACLs disabled (recommended)
  
  Block Public Access: 
    ✅ UNCHECK "Block all public access" (frontend needs to be public)
    ✅ Confirm the warning checkbox
  
  Versioning: Disabled (not needed for static frontend)
  
→ Create bucket

After creation → Click your bucket → Properties tab:
  Static website hosting → Edit → Enable
  Index document: index.html
  Error document: index.html  ← Important! Makes React Router work (SPA fallback)
  → Save changes

Bucket Policy → Paste this (replace BUCKET_NAME):
```

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

---

### PHASE 9 — Create CloudFront Distribution

```
AWS Console → CloudFront → Create distribution

  Origin domain: (select your S3 bucket from dropdown — pick the .s3.amazonaws.com URL, NOT the website endpoint)
  
  S3 bucket access: Yes, update the bucket policy (let CloudFront manage it)
  
  Viewer protocol policy: Redirect HTTP to HTTPS
  
  Allowed HTTP methods: GET, HEAD
  
  Cache policy: CachingOptimized (default)
  
  Price class: Use only North America and Europe  ← Cheapest option
  
  Default root object: index.html
  
  Under "Custom error responses" → Create custom error response:
    HTTP error code: 403
    Customize error response: Yes
    Response page path: /index.html
    HTTP response code: 200
  (This handles React Router — 403 on unknown paths returns index.html)
  
→ Create distribution

Wait ~10 minutes for deployment. Note your CloudFront domain:
  dXXXXXXXX.cloudfront.net
```

---

### PHASE 10 — Set GitHub Secrets

```
GitHub → Your repo → Settings → Secrets and variables → Actions → New repository secret

Add these one by one:
  DOCKERHUB_USERNAME     → your Docker Hub username
  DOCKERHUB_TOKEN        → Docker Hub → Account Settings → Security → New Access Token
  AWS_ACCESS_KEY_ID      → from the IAM user CSV you downloaded earlier
  AWS_SECRET_ACCESS_KEY  → from the IAM user CSV
  EC2_HOST               → your Elastic IP address (e.g. 54.123.45.67)
  EC2_SSH_KEY            → Open your .pem file in Notepad → Copy ALL contents → Paste here
  S3_BUCKET_NAME         → your S3 bucket name
  CLOUDFRONT_DISTRIBUTION_ID → from CloudFront console (starts with E...)
  CLOUDFRONT_DOMAIN      → dXXXXXXXX.cloudfront.net
```

---

### PHASE 11 — Create docker-compose.yml on EC2 Server

```bash
# On your EC2 (via SSH)
nano /home/ec2-user/docker-compose.yml
```

Paste this (replace DOCKER_HUB_USERNAME):

```yaml
services:
  api:
    image: YOUR_DOCKERHUB_USERNAME/travel-planner-api:latest
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      # Secrets loaded from AWS SSM at container start via entrypoint script
      - AWS_DEFAULT_REGION=us-east-1
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
```

> **Note**: Instead of passing raw env variables, your Node.js app will load secrets from SSM Parameter Store using the IAM role. Add SSM loading to your `server/src/index.ts` startup.

---

## 📝 Execution Order — What to Do in Sequence

```
Phase 1  → Secure AWS (MFA, IAM user, billing alert)
Phase 2  → Create EC2 Key Pair
Phase 3  → Create Security Group
Phase 4  → Launch EC2 (t2.micro, Amazon Linux 2023)
Phase 5  → Create IAM Role → Attach to EC2
Phase 6  → SSH into EC2 → Install Docker + Node.js
Phase 7  → Create & Associate Elastic IP
Phase 8  → Create S3 bucket
Phase 9  → Create CloudFront distribution
Phase 10 → Set GitHub Secrets (10 values)
Phase 11 → Create docker-compose.yml on EC2

Then:
Step 3.3 → Create Dockerfiles (just the files — no local build)
Step 3.4 → Adapt Terraform (optional — manual setup is already done)
Step 3.5 → Create GitHub Actions workflows
Step 3.6 → Push to main → CI/CD auto-builds and deploys
```

---

## 🔄 How It All Flows (No Local Docker Needed)

```
Your PC (write code + push to GitHub)
    ↓
GitHub Actions Runner (Ubuntu - has Docker built in!)
    ↓ Builds Docker image from your Dockerfile
    ↓ Pushes to Docker Hub
    ↓ Syncs React build to S3
    ↓ SSHes into your EC2
    ↓ Runs: docker pull + docker-compose up
EC2 Server (runs the Docker containers)
    ↓ API running on port 5000
S3 + CloudFront (serves React frontend with HTTPS)
```

**You NEVER need Docker on your Windows PC.** GitHub Actions is your Docker build engine.

---

## ✅ What's SKIPPED vs. ADAPTED

| Item from Plan | Status | Reason |
|---|---|---|
| `server/Dockerfile` | ✅ Create the file | GitHub Actions builds it |
| `client/Dockerfile` | ✅ Create the file | GitHub Actions builds it |
| `docker-compose.yml` (local dev) | ⏭️ Skip local use | No local Docker |
| `docker-compose.yml` on **EC2** | ✅ Create on server | EC2 has Docker |
| Terraform | ⚠️ Optional | Manual setup above replaces it |
| `terraform apply` | ⏭️ Skip | You do it manually via console |
| GitHub Actions CI | ✅ Keep | Actions has Docker — works fine |
| GitHub Actions CD | ✅ Keep | Pushes to EC2 via SSH |
| `docker build` locally (Step 3.6) | ⏭️ Skip | Let Actions do it |
| `aws s3 sync` locally | ✅ Actions does this | |

> [!IMPORTANT]
> Terraform is optional for you. Since you've done the manual AWS setup, you can skip steps 3.4's terraform apply. Just make sure the GitHub Actions CD pipeline has the correct secrets so it can deploy directly.

