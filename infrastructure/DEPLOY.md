# Step 3.6 — Deployment Commands (Run Once to Launch Everything)

## Pre-Requisites Checklist (Do these BEFORE running commands)

- [ ] **AWS Account** created at aws.amazon.com/free
- [ ] **Billing alert** set ($0 budget) in AWS → Billing → Budgets
- [ ] **MFA enabled** on root account → My Account → Security Credentials
- [ ] **IAM User** created (`terraform-deployer`) with these policies:
  - AmazonEC2FullAccess, AmazonS3FullAccess, CloudFrontFullAccess
  - AmazonSSMFullAccess, CloudWatchLogsFullAccess, IAMFullAccess
  - Access key CSV downloaded
- [ ] **EC2 Key Pair** created (name: `travel-planner-key`) → .pem downloaded to `C:\Users\PRASAD\.ssh\`
- [ ] **Terraform CLI** installed: https://developer.hashicorp.com/terraform/install → Windows AMD64
  - Extract `terraform.exe` → Move to `C:\terraform\`
  - Add `C:\terraform\` to Windows PATH
  - Verify: open new PowerShell → `terraform --version`
- [ ] **Docker Hub account** created at hub.docker.com + access token created
- [ ] **MongoDB Atlas M0** cluster running with connection string ready
- [ ] **Groq API Key** from console.groq.com

---

## PHASE A — Set AWS Credentials in PowerShell

Open **new PowerShell** and set these (from your IAM user CSV):

```powershell
$env:AWS_ACCESS_KEY_ID = "PASTE_FROM_CSV"
$env:AWS_SECRET_ACCESS_KEY = "PASTE_FROM_CSV"
$env:AWS_DEFAULT_REGION = "ap-south-1"
```

> ⚠️ These expire when you close PowerShell. Set them again if you open a new window.

---

## PHASE B — Create terraform.tfvars (Your Secrets File)

In the infrastructure/ folder, create `terraform.tfvars` (copy from the .example):

```powershell
cd "d:\Presidio Capstone Project\infrastructure"
Copy-Item terraform.tfvars.example terraform.tfvars
```

Then open `terraform.tfvars` in VS Code and fill in your real values:

```
aws_region         = "ap-south-1"
project_name       = "travel-planner"
key_pair_name      = "travel-planner-key"
dockerhub_username = "dhayananth1511"

mongo_uri          = "mongodb+srv://..."
groq_api_key       = "gsk_..."
jwt_access_secret  = "your-32-char-random-string"
jwt_refresh_secret = "your-different-32-char-random-string"
google_maps_key    = "AIza..."

port                 = 5000
jwt_access_expires   = "15m"
jwt_refresh_expires  = "7d"
hotelbeds_api_key    = "your-hotelbeds-api-key"
hotelbeds_api_secret = "your-hotelbeds-api-secret"
hotelbeds_base_url   = "https://api.test.hotelbeds.com"
activity_api_key     = "your-activity-api-key"
transfers_api_key    = "your-transfers-api-key"
google_calendar_client_id     = "your-google-calendar-client-id"
google_calendar_client_secret = "your-google-calendar-client-secret"
google_calendar_redirect_uri  = "http://localhost:5000/api/auth/google/callback"
aviationstack_api_key = "your-aviationstack-api-key"
openweather_api_key   = "your-openweather-api-key"
```


---

## PHASE C — Terraform Init

```powershell
cd "d:\Presidio Capstone Project\infrastructure"

terraform init
```

**What this does**: Downloads the AWS and Random providers (~50MB). Only needed once.

**Expected output:**
```
Initializing the backend...
Initializing provider plugins...
- Finding hashicorp/aws versions matching "~> 5.0"...
- Installing hashicorp/aws v5.x.x...
Terraform has been successfully initialized!
```

---

## PHASE D — Terraform Plan (Preview — No AWS Charges Yet)

```powershell
terraform plan -var-file="terraform.tfvars"
```

**What this does**: Shows you exactly what will be created — no actual AWS resources are made yet. Read the output carefully.

**Expected output:** Shows ~15 resources to be created including:
- `aws_instance.api` (EC2 t2.micro)
- `aws_eip.api_eip` (Elastic IP)
- `aws_s3_bucket.frontend`
- `aws_cloudfront_distribution.frontend`
- `aws_ssm_parameter.mongo_uri` (and 4 others)
- `aws_iam_role.ec2_role`
- `aws_cloudwatch_log_group.api_logs`

> ✅ If plan shows "15 to add, 0 to change, 0 to destroy" → proceed to apply

---

## PHASE E — Terraform Apply (Creates All AWS Resources)

```powershell
terraform apply -var-file="terraform.tfvars" -auto-approve
```

**What this does**: Creates all AWS resources. Takes ~3-5 minutes.

**Expected output at the end:**
```
Apply complete! Resources: 15 added, 0 changed, 0 destroyed.

Outputs:

ec2_elastic_ip             = "13.127.xx.xx"
cloudfront_domain          = "dxxxxxxxx.cloudfront.net"
cloudfront_distribution_id = "EXXXXXXXXXX"
s3_bucket_name             = "travel-planner-frontend-xxxx"
api_url                    = "http://13.127.xx.xx:5000"
frontend_url               = "https://dxxxxxxxx.cloudfront.net"

next_steps = <<EOT
  ✅ Terraform apply complete! Here's what to do next:
  1. Add these to GitHub Secrets...
EOT
```

> **SAVE THESE OUTPUTS** — you need them for GitHub Secrets.

---

## PHASE F — Set GitHub Secrets (9 Values)

Go to: **GitHub → Your Repo → Settings → Secrets and variables → Actions → New repository secret**

Add each one:

| Secret Name | Value | Where to get it |
|---|---|---|
| `DOCKERHUB_USERNAME` | your Docker Hub username | Docker Hub account |
| `DOCKERHUB_TOKEN` | Docker Hub access token | Hub → Account Settings → Security → New Access Token |
| `AWS_ACCESS_KEY_ID` | from IAM user CSV | CSV you downloaded |
| `AWS_SECRET_ACCESS_KEY` | from IAM user CSV | CSV you downloaded |
| `EC2_HOST` | `13.127.xx.xx` | Terraform output: `ec2_elastic_ip` |
| `EC2_SSH_KEY` | full contents of .pem file | Open .pem in Notepad → Ctrl+A → Copy ALL |
| `S3_BUCKET_NAME` | `travel-planner-frontend-xxxx` | Terraform output: `s3_bucket_name` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `EXXXXXXXXXX` | Terraform output |
| `CLOUDFRONT_DOMAIN` | `dxxxxxxxx.cloudfront.net` | Terraform output |

---

## PHASE G — Push Code → Auto Deploy

```powershell
cd "d:\Presidio Capstone Project"

git add .
git commit -m "feat: add Docker, Terraform, and GitHub Actions CI/CD"
git push origin main
```

**What happens automatically (GitHub Actions):**
1. ✅ CI runs → TypeScript check + build test
2. ✅ CD runs → Docker build + push to Docker Hub
3. ✅ CD → React build → S3 sync → CloudFront invalidation
4. ✅ CD → SSH into EC2 → docker pull → restart containers

Watch progress at: `GitHub → Your Repo → Actions` tab

---

## PHASE H — Verify Everything Works

```powershell
# Replace with your Elastic IP from Terraform output
$EC2_IP = "13.127.xx.xx"

# Test API health endpoint
curl http://$EC2_IP`:5000/health
# Expected: {"status":"ok","timestamp":"..."}

# Test auth endpoint
curl -X POST http://$EC2_IP`:5000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{"name":"Test User","email":"test@test.com","password":"password123"}'
# Expected: {"message":"Registration successful","accessToken":"..."}
```

Then open your browser:
```
https://dxxxxxxxx.cloudfront.net
```

You should see your React login page served over HTTPS! 🎉

---

## Final Verification Checklist

- [ ] `GET http://EC2_IP:5000/health` → `{"status":"ok"}`
- [ ] `POST /api/auth/register` → creates user in MongoDB Atlas
- [ ] `POST /api/auth/login` → returns JWT
- [ ] `POST /api/trips/plan` → AI agents run, returns plan
- [ ] Frontend loads at CloudFront HTTPS URL
- [ ] GitHub Actions CI passes on PRs
- [ ] GitHub Actions CD passes on push to main
- [ ] AWS Console → EC2 → Instance shows running
- [ ] AWS Console → S3 → Bucket has React build files
- [ ] AWS Console → CloudFront → Distribution enabled
- [ ] MongoDB Atlas → Collections → Shows users + trips

---

## Teardown (When Done — Stop All AWS Charges)

When your evaluation/demo is complete, destroy everything to avoid any charges:

```powershell
cd "d:\Presidio Capstone Project\infrastructure"
terraform destroy -var-file="terraform.tfvars" -auto-approve
```

This deletes: EC2, Elastic IP, S3, CloudFront, SSM params, IAM role, CloudWatch logs.
MongoDB Atlas M0 is free forever — leave it.
