# Steps 3.3–3.6 — Full Deployment Plan
## (Terraform + AWS + GitHub Actions — No Local Docker)

> **READ FIRST**: This is the PLAN only. Nothing is done yet. You approve → then I execute.

---

## 🔑 Your Constraints (What I'm Working Around)

| Constraint | How I Handle It |
|---|---|
| ❌ No Docker on your Windows PC | GitHub Actions runner (Ubuntu) builds Docker images — you never need Docker locally |
| ✅ EC2 has Docker | Terraform's `user_data` auto-installs Docker + Docker Compose on EC2 on first boot |
| ✅ Terraform must be used | Full `main.tf`, `variables.tf`, `outputs.tf` will be created |
| ✅ Cloud best practices | IAM Role, SSM secrets, restricted SSH, Elastic IP, CloudWatch logs |

---

## 📦 What Will Be CREATED (Files)

### Step 3.3 — Docker Files (3 files)
| File | What It Does |
|---|---|
| `server/Dockerfile` | Multi-stage build: TypeScript → compiled JS, runs as non-root |
| `client/Dockerfile` | Multi-stage build: Vite → Nginx static server |
| `client/nginx.conf` | Nginx config — SPA fallback (React Router support) |
| `docker-compose.prod.yml` | Production compose file placed ON the EC2 server |

> `docker-compose.yml` (local dev) already exists or is skipped since you have no local Docker.

---

### Step 3.4 — Terraform Files (4 files)
| File | What It Provisions |
|---|---|
| `infrastructure/main.tf` | EC2 + Security Group + IAM Role + S3 + CloudFront + SSM params |
| `infrastructure/variables.tf` | All input variables (region, keys, secrets) |
| `infrastructure/outputs.tf` | Prints EC2 IP + CloudFront URL + S3 bucket name after apply |
| `infrastructure/terraform.tfvars.example` | Template — you fill in your real values, never committed to Git |

#### What Terraform Provisions in AWS (Full List)

```
EC2 t2.micro (Amazon Linux 2023)
  └── Security Group (SSH from your IP only, port 80 + 5000 open)
  └── IAM Instance Profile (allows EC2 to read SSM + write CloudWatch logs)
  └── User Data script (auto-installs Docker + Docker Compose on first boot)
  └── Elastic IP (fixed public IP, free while attached)

S3 Bucket
  └── Website configuration (index.html SPA fallback)
  └── Bucket policy (public read for CloudFront)

CloudFront Distribution
  └── Origin: S3 bucket
  └── HTTPS redirect
  └── Custom error response (403 → index.html for React Router)
  └── PriceClass_100 (cheapest — NA + Europe CDN only)

SSM Parameter Store (for secrets — NOT in .env on server)
  └── /travel-planner/MONGO_URI         (SecureString)
  └── /travel-planner/GROQ_API_KEY      (SecureString)
  └── /travel-planner/JWT_ACCESS_SECRET (SecureString)
  └── /travel-planner/JWT_REFRESH_SECRET(SecureString)
  └── /travel-planner/GOOGLE_MAPS_KEY   (SecureString)

IAM Role (travel-planner-ec2-role)
  └── SSMReadOnlyAccess (EC2 reads secrets at startup)
  └── CloudWatchAgentServerPolicy (EC2 sends logs to CloudWatch)

Random ID resource (for unique S3 bucket name suffix)
```

---

### Step 3.5 — GitHub Actions (2 files)
| File | Trigger | What It Does |
|---|---|---|
| `.github/workflows/ci.yml` | Every Pull Request to `main` | TypeScript check + npm audit + build both apps + Docker build test |
| `.github/workflows/cd.yml` | Every push/merge to `main` | Build + push Docker image to DockerHub + S3 sync frontend + SSH EC2 to pull + restart |

#### GitHub Secrets Required (you set these manually in GitHub repo settings)
```
DOCKERHUB_USERNAME          → your Docker Hub username
DOCKERHUB_TOKEN             → Docker Hub access token (not your password)
AWS_ACCESS_KEY_ID           → IAM user access key
AWS_SECRET_ACCESS_KEY       → IAM user secret key
EC2_HOST                    → Elastic IP of your EC2 (from Terraform output)
EC2_SSH_KEY                 → Full contents of your .pem key file
S3_BUCKET_NAME              → from Terraform output
CLOUDFRONT_DISTRIBUTION_ID  → from Terraform output
CLOUDFRONT_DOMAIN           → from Terraform output (dXXXX.cloudfront.net)
```

---

### Step 3.6 — Deployment Commands

These are the commands YOU run (on your PC) **once** to deploy everything:

```
Phase A → Install Terraform CLI (one-time)
Phase B → Create AWS credentials on PC (for Terraform)
Phase C → terraform init
Phase D → terraform plan (preview, no charges)
Phase E → terraform apply (creates all AWS resources)
Phase F → Note outputs (EC2 IP, CloudFront URL, S3 bucket)
Phase G → Push code to GitHub → Actions auto-deploys to EC2 + S3
```

---

## 💰 AWS Free Tier — How to Stay at $0

### What's Free (12 months)

| Service | Free Limit | Your Usage |
|---|---|---|
| EC2 t2.micro | 750 hrs/month (=31 days) | 1 instance only → ✅ Free |
| S3 storage | 5 GB | React build ~5 MB → ✅ Free |
| S3 requests | 20,000 GET + 2,000 PUT | Low usage → ✅ Free |
| CloudFront | 1 TB data + 10M requests | Demo traffic → ✅ Free |
| Elastic IP | Free when attached to running EC2 | ✅ Free |
| SSM Parameter Store | Standard tier 10,000 params free | We use 5 → ✅ Free |
| CloudWatch Logs | 5 GB ingestion free | App logs → ✅ Free |
| Data Transfer | 15 GB/month out | API responses → ✅ Free |

### ❌ Traps That WILL Bill You

| Trap | How Terraform Avoids It |
|---|---|
| Running 2+ EC2 instances | Terraform creates exactly 1 t2.micro |
| Elastic IP not attached | Terraform attaches it to EC2 on creation |
| NAT Gateway ($0.045/hr) | NOT in our Terraform — never created |
| RDS database | Not used — MongoDB Atlas is external |
| CloudFront with paid price class | Terraform uses `PriceClass_100` (cheapest) |
| Custom SSL cert (ACM) | We use default CloudFront cert — free |

### ✅ Do This First — Billing Alert
```
AWS Console → Billing → Budgets → Create Budget
→ "Zero spend budget" template → Enter your email
→ Creates alert if ANY charge happens
```

---

## 🔧 Pre-Requisites (What YOU Do in AWS Console BEFORE Terraform)

Terraform can't create these — you do them manually once:

### PRE-1: Create AWS Account + Enable MFA
```
aws.amazon.com/free → Create account
→ My Account → Security credentials → Enable MFA (use Google Authenticator)
```

### PRE-2: Create IAM User for Terraform (Least Privilege)
```
IAM → Users → Create user
  Name: terraform-deployer
  Attach policies:
    AmazonEC2FullAccess
    AmazonS3FullAccess
    CloudFrontFullAccess
    AmazonSSMFullAccess
    CloudWatchLogsFullAccess
    IAMFullAccess         ← needed for Terraform to create IAM roles
→ Create Access Key → Download CSV
```

### PRE-3: Create EC2 Key Pair
```
EC2 → Key Pairs → Create key pair
  Name: travel-planner-key
  Type: RSA
  Format: .pem
→ Download and save to C:\Users\PRASAD\.ssh\travel-planner-key.pem
```

### PRE-4: Install Terraform CLI (on your Windows PC)
```
Go to: https://developer.hashicorp.com/terraform/install
→ Windows → AMD64 → Download zip
→ Extract terraform.exe
→ Move to C:\terraform\
→ Add C:\terraform\ to Windows PATH environment variable
→ Open new PowerShell → terraform --version (should print version)
```

### PRE-5: Configure AWS Credentials on PC (for Terraform)
```powershell
# In PowerShell — Terraform uses these to talk to AWS
$env:AWS_ACCESS_KEY_ID = "PASTE_FROM_CSV"
$env:AWS_SECRET_ACCESS_KEY = "PASTE_FROM_CSV"
$env:AWS_DEFAULT_REGION = "us-east-1"
```

### PRE-6: Create Docker Hub Account + Access Token
```
hub.docker.com → Sign up (free)
→ Account Settings → Security → New Access Token
  Description: github-actions
  Permissions: Read, Write, Delete
→ Copy token (shown only once)
```

---

## 🗂️ Complete Execution Order

```
[ ] PRE-1: AWS account + MFA + billing alert
[ ] PRE-2: IAM user for Terraform → download CSV
[ ] PRE-3: EC2 Key Pair → download .pem
[ ] PRE-4: Install Terraform CLI on PC
[ ] PRE-5: Set AWS env vars in PowerShell
[ ] PRE-6: Docker Hub account + access token

── I CREATE FILES ──────────────────────────────────
[ ] 3.3a: server/Dockerfile
[ ] 3.3b: client/Dockerfile
[ ] 3.3c: client/nginx.conf
[ ] 3.3d: docker-compose.prod.yml (for EC2)
[ ] 3.4a: infrastructure/main.tf     ← FULL Terraform with EC2+S3+CF+IAM+SSM
[ ] 3.4b: infrastructure/variables.tf
[ ] 3.4c: infrastructure/outputs.tf
[ ] 3.4d: infrastructure/terraform.tfvars.example
[ ] 3.5a: .github/workflows/ci.yml
[ ] 3.5b: .github/workflows/cd.yml
────────────────────────────────────────────────────

── YOU RUN COMMANDS ────────────────────────────────
[ ] 3.6a: cd infrastructure → terraform init
[ ] 3.6b: terraform plan    (preview only — nothing created yet)
[ ] 3.6c: terraform apply   (creates EC2 + S3 + CloudFront + SSM + Elastic IP)
[ ] 3.6d: Note outputs → paste into GitHub Secrets (9 values)
[ ] 3.6e: git push → GitHub Actions deploys Docker + S3 frontend automatically
[ ] 3.6f: Visit CloudFront URL → verify app is live
```

---

## 🔄 How The Full Flow Works (End to End)

```
YOUR PC
  ↓ git push to GitHub
  
GITHUB ACTIONS (Ubuntu runner — has Docker built in)
  ↓ [CI] TypeScript check, npm audit, Docker build test
  ↓ [CD] docker build → push to Docker Hub
  ↓ [CD] npm run build (React) → aws s3 sync → S3 bucket
  ↓ [CD] CloudFront cache invalidation
  ↓ [CD] SSH into EC2 → docker pull → docker-compose up -d

EC2 INSTANCE (t2.micro — Docker runs HERE)
  ↓ docker pull latest API image from Docker Hub
  ↓ reads secrets from AWS SSM Parameter Store
  ↓ starts: API container (port 5000) + Redis container

USERS
  → Visit CloudFront URL (HTTPS) → React frontend → API on EC2

YOU NEVER NEED DOCKER ON YOUR WINDOWS PC.
```

---

## ⚠️ Important Notes About Terraform Adaptations

The implementation plan's original `main.tf` has a few things I'll **improve** to match cloud best practices and your situation:

| Original Plan Issue | My Fix |
|---|---|
| Old Amazon Linux 2 AMI (deprecated) | Use Amazon Linux 2023 AMI |
| SSH open to 0.0.0.0/0 (insecure) | SSH restricted to your current IP |
| Secrets passed as Terraform vars in user_data | Secrets in SSM Parameter Store — EC2 fetches them at startup |
| No Elastic IP in original Terraform | Add `aws_eip` resource so EC2 IP is fixed |
| No IAM Role in original (though variables.tf mentions it) | Full IAM Role + Instance Profile created by Terraform |
| No CloudWatch log group | Add `aws_cloudwatch_log_group` resource |

---

> **SAY "PROCEED" AND I WILL START CREATING ALL FILES IN ORDER.**
> I will go step by step and show you each file before moving to the next group.
