# ScaleOps Demo

> **AWS Cloud Club MUET — HacktoberFest 3.0**  
> *Intelligent Auto Scaling and Load Management for Web Applications*

A real Next.js application deployed on **AWS EC2** behind an **Application Load Balancer** with horizontal auto-scaling via an **EC2 Auto Scaling Group**, fully provisioned with **Terraform** and deployed through **GitHub Actions**.

---

## Architecture

```
Internet
   │ HTTP :80
   ▼
Application Load Balancer (internet-facing)
   │ HTTP :3000  (ALB SG → EC2 SG only)
   ▼
Auto Scaling Group  ←→  CloudWatch CPU Alarm
   ├── EC2 Instance (AZ-1)  →  systemd: scaleops-demo
   └── EC2 Instance (AZ-2)  →  systemd: scaleops-demo
            │
            ▼  (IAM role, no static credentials)
         S3 Artifact Bucket
         (versioned release tarballs)
```

**Tech stack:** Next.js 15 · TypeScript · Tailwind CSS · Node.js 20  
**Infrastructure:** VPC · IGW · 2 × Public Subnets · ALB · ASG · Launch Template · CloudWatch  
**CI/CD:** GitHub Actions · OIDC (no long-lived keys) · Terraform S3 backend

---

## Quick Start — Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run dev server
npm run dev
# Open http://localhost:3000

# 3. Test API endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/info
curl http://localhost:3000/api/metrics

# 4. Enable workload endpoint (for local testing only)
WORKLOAD_ENABLED=true npm run dev
curl "http://localhost:3000/api/workload?durationMs=5000"
```

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check — returns 200 when healthy (used by ALB) |
| `/api/info` | GET | Instance metadata: ID, region, AZ, hostname, version, uptime |
| `/api/metrics` | GET | Per-instance request counters, memory usage |
| `/api/workload` | GET | **Disabled by default.** CPU-intensive load for scaling tests |

### `/api/workload` — Safe Usage

```bash
# Enable on EC2 (set in /etc/scaleops-demo.env):
WORKLOAD_ENABLED=true

# Request a 10-second bounded CPU burst:
curl "http://YOUR-ALB-DNS/api/workload?durationMs=10000"

# Safety limits (configurable via env):
# WORKLOAD_MAX_MS=20000          (max duration per request, hard ceiling 30s)
# WORKLOAD_MAX_CONCURRENCY=3    (max parallel workload requests)
```

---

## AWS Deployment — Step by Step

### Prerequisites

- AWS CLI configured: `aws configure`
- Terraform >= 1.6: `terraform -version`
- Node.js 20: `node --version`
- Git

### Step 1: Configure AWS CLI

```bash
aws configure
# AWS Access Key ID: YOUR_KEY
# AWS Secret Access Key: YOUR_SECRET
# Default region name: us-east-1
# Default output format: json
```

### Step 2: Set Up GitHub OIDC IAM Role

```bash
# 1. Create the OIDC provider (run once per account)
aws iam create-open-id-connect-provider \
  --url "https://token.actions.githubusercontent.com" \
  --client-id-list "sts.amazonaws.com" \
  --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1"

# 2. Replace values below with your own
GITHUB_ORG="YOUR_GITHUB_ORG"
REPO_NAME="scaleops-demo"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

cat > /tmp/oidc-trust.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:${GITHUB_ORG}/${REPO_NAME}:*"
      }
    }
  }]
}
EOF

aws iam create-role \
  --role-name scaleops-github-deploy \
  --assume-role-policy-document file:///tmp/oidc-trust.json

aws iam attach-role-policy \
  --role-name scaleops-github-deploy \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
```

### Step 3: Create Terraform State Backend

```bash
REGION="us-east-1"
STATE_BUCKET="scaleops-tf-state-$(aws sts get-caller-identity --query Account --output text)"
LOCK_TABLE="scaleops-tf-locks"

aws s3api create-bucket --bucket "$STATE_BUCKET" --region "$REGION"
aws s3api put-bucket-versioning --bucket "$STATE_BUCKET" \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket "$STATE_BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket "$STATE_BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

aws dynamodb create-table \
  --table-name "$LOCK_TABLE" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"
```

### Step 4: Create Private Artifact Bucket

```bash
ARTIFACT_BUCKET="scaleops-artifacts-$(aws sts get-caller-identity --query Account --output text)"

aws s3api create-bucket --bucket "$ARTIFACT_BUCKET" --region "$REGION"
aws s3api put-bucket-versioning --bucket "$ARTIFACT_BUCKET" \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket "$ARTIFACT_BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'
aws s3api put-public-access-block --bucket "$ARTIFACT_BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### Step 5: Configure GitHub Repository Variables

Go to **GitHub → Settings → Secrets and variables → Actions → Variables**:

| Variable | Example Value |
|----------|--------------|
| `AWS_REGION` | `us-east-1` |
| `AWS_ROLE_ARN` | `arn:aws:iam::123456789:role/scaleops-github-deploy` |
| `TF_STATE_BUCKET` | `scaleops-tf-state-123456789` |
| `TF_STATE_KEY` | `scaleops-demo/terraform.tfstate` |
| `TF_STATE_LOCK_TABLE` | `scaleops-tf-locks` |
| `DEPLOY_ARTIFACT_BUCKET` | `scaleops-artifacts-123456789` |

### Step 6: Create GitHub Environments

In **GitHub → Settings → Environments**:

1. **`infrastructure`** — Add required reviewer(s). Gates `terraform apply`.
2. **`production`** — Add required reviewer(s). Gates instance refresh.
3. **`infrastructure-destroy`** — Stricter environment for destroy.

### Step 7: Produce the First Release

```bash
npm install && npm run build
SHA=$(git rev-parse --short HEAD)
bash scripts/package-release.sh "$SHA"

aws s3 cp \
  "/tmp/scaleops-release/scaleops-demo-$SHA.tar.gz" \
  "s3://$ARTIFACT_BUCKET/releases/$SHA/scaleops-demo-$SHA.tar.gz" \
  --server-side-encryption aws:kms --region "$REGION"
```

### Step 8: Provision Infrastructure

```bash
cd terraform
terraform init \
  -backend-config="bucket=$STATE_BUCKET" \
  -backend-config="key=scaleops-demo/terraform.tfstate" \
  -backend-config="region=$REGION" \
  -backend-config="encrypt=true" \
  -backend-config="dynamodb_table=$LOCK_TABLE"

terraform apply \
  -var="deploy_artifact_bucket=$ARTIFACT_BUCKET" \
  -var="artifact_version=$SHA" \
  -var="aws_region=$REGION"

ALB_URL=$(terraform output -raw alb_dns_name)
echo "App: $ALB_URL"
```

### Step 9: Access & Test

```bash
curl "$ALB_URL/api/health"
curl "$ALB_URL/api/info"

# Baseline load test
k6 run tests/k6-baseline.js -e ALB_URL=$ALB_URL

# Ramp-up to trigger scale-out
k6 run tests/k6-rampup.js -e ALB_URL=$ALB_URL

# Watch instance count change
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names scaleops-demo-hackathon-asg \
  --query 'AutoScalingGroups[0].Instances[*].{ID:InstanceId,State:LifecycleState}' \
  --output table
```

---

## Rollback

```bash
PREV_SHA="abc1234"   # previous known-good SHA
cd terraform
terraform apply \
  -var="deploy_artifact_bucket=$ARTIFACT_BUCKET" \
  -var="artifact_version=$PREV_SHA" \
  -var="aws_region=$REGION"

aws autoscaling start-instance-refresh \
  --auto-scaling-group-name scaleops-demo-hackathon-asg \
  --strategy Rolling \
  --preferences "MinHealthyPercentage=50,InstanceWarmup=120"
```

---

## Destroy

```bash
cd terraform
terraform destroy \
  -var="deploy_artifact_bucket=$ARTIFACT_BUCKET" \
  -var="artifact_version=placeholder" \
  -var="aws_region=$REGION"

# Clean up S3 buckets (optional)
aws s3 rm "s3://$ARTIFACT_BUCKET" --recursive
aws s3api delete-bucket --bucket "$ARTIFACT_BUCKET" --region "$REGION"
aws s3 rm "s3://$STATE_BUCKET" --recursive
aws s3api delete-bucket --bucket "$STATE_BUCKET" --region "$REGION"
aws dynamodb delete-table --table-name "$LOCK_TABLE" --region "$REGION"
```

---

## Scaling Policy

| Parameter | Value |
|-----------|-------|
| CPU target | 50% |
| Min instances | 1 |
| Max instances | 3 |
| Warmup period | 120s |
| Health grace period | 180s |

---

## Cost Estimate (us-east-1, 1 instance)

| Resource | ~Monthly |
|----------|----------|
| t3.micro EC2 | $8.35 |
| ALB | $18.00 |
| Data Transfer | <$1.00 |
| **Total** | **~$27** |

> Destroy resources after the hackathon demo to avoid ongoing charges.
