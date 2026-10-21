# ==============================================================================
# ScaleOps Demo - AWS Prerequisite Bootstrap Script (PowerShell)
# Run this once from your local machine (with AWS CLI configured) or CloudShell.
# It creates:
#   1. S3 bucket for Terraform State
#   2. DynamoDB table for Terraform State Locks
#   3. S3 bucket for Deploy Artifacts
# ==============================================================================

$ErrorActionPreference = "Stop"

# Set Region (change if needed)
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }

Write-Host "🔍 Checking AWS Identity..." -ForegroundColor Cyan
try {
    $callerIdentity = aws sts get-caller-identity --output json | ConvertFrom-Json
} catch {
    Write-Host "❌ Failed to connect to AWS. Make sure 'aws configure' is run or environment variables are set." -ForegroundColor Red
    exit 1
}

$AccountId = $callerIdentity.Account
Write-Host "✅ AWS Account ID: $AccountId" -ForegroundColor Green
Write-Host "✅ Target Region:   $Region" -ForegroundColor Green

# Unique bucket names per AWS account
$StateBucket    = "scaleops-tf-state-$AccountId"
$ArtifactBucket = "scaleops-artifacts-$AccountId"
$LockTable      = "scaleops-tf-locks"

Write-Host "`n🚀 1. Creating Terraform State S3 Bucket: $StateBucket" -ForegroundColor Cyan
if ($Region -eq "us-east-1") {
    aws s3api create-bucket --bucket $StateBucket --region $Region 2>$null
} else {
    aws s3api create-bucket --bucket $StateBucket --region $Region --create-bucket-configuration LocationConstraint=$Region 2>$null
}
aws s3api put-bucket-versioning --bucket $StateBucket --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket $StateBucket --server-side-encryption-configuration '{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"AES256\"}}]}'
aws s3api put-public-access-block --bucket $StateBucket --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
Write-Host "✅ State Bucket Ready!" -ForegroundColor Green

Write-Host "`n🚀 2. Creating DynamoDB State Lock Table: $LockTable" -ForegroundColor Cyan
try {
    aws dynamodb describe-table --table-name $LockTable --region $Region 2>$null | Out-Null
    Write-Host "✅ Lock Table already exists." -ForegroundColor Green
} catch {
    aws dynamodb create-table `
      --table-name $LockTable `
      --attribute-definitions AttributeName=LockID,AttributeType=S `
      --key-schema AttributeName=LockID,KeyType=HASH `
      --billing-mode PAY_PER_REQUEST `
      --region $Region | Out-Null
    Write-Host "✅ Lock Table created!" -ForegroundColor Green
}

Write-Host "`n🚀 3. Creating Artifact S3 Bucket: $ArtifactBucket" -ForegroundColor Cyan
if ($Region -eq "us-east-1") {
    aws s3api create-bucket --bucket $ArtifactBucket --region $Region 2>$null
} else {
    aws s3api create-bucket --bucket $ArtifactBucket --region $Region --create-bucket-configuration LocationConstraint=$Region 2>$null
}
aws s3api put-bucket-versioning --bucket $ArtifactBucket --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket $ArtifactBucket --server-side-encryption-configuration '{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"AES256\"}}]}'
aws s3api put-public-access-block --bucket $ArtifactBucket --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
Write-Host "✅ Artifact Bucket Ready!" -ForegroundColor Green

Write-Host "`n==============================================================================" -ForegroundColor Yellow
Write-Host "🎉 ALL AWS PREREQUISITES CREATED SUCCESSFULLY!" -ForegroundColor Yellow
Write-Host "==============================================================================" -ForegroundColor Yellow
Write-Host "`nNow configure your GitHub Repository Settings:" -ForegroundColor Cyan
Write-Host "`n[A] Secrets (Settings -> Secrets and variables -> Actions -> Secrets):" -ForegroundColor Magenta
Write-Host "    AWS_ACCESS_KEY_ID      = <Your IAM Access Key ID>"
Write-Host "    AWS_SECRET_ACCESS_KEY  = <Your IAM Secret Access Key>"

Write-Host "`n[B] Variables (Settings -> Secrets and variables -> Actions -> Variables):" -ForegroundColor Magenta
Write-Host "    AWS_REGION             = $Region"
Write-Host "    TF_STATE_BUCKET        = $StateBucket"
Write-Host "    TF_STATE_KEY           = scaleops-demo/terraform.tfstate"
Write-Host "    TF_STATE_LOCK_TABLE    = $LockTable"
Write-Host "    DEPLOY_ARTIFACT_BUCKET = $ArtifactBucket"
Write-Host "`n==============================================================================" -ForegroundColor Yellow
