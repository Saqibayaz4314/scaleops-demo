#!/usr/bin/env bash
# ==============================================================================
# ScaleOps Demo - AWS Prerequisite Bootstrap Script (Bash)
# Run this once from your terminal (with AWS CLI configured) or AWS CloudShell.
# It creates:
#   1. S3 bucket for Terraform State
#   2. DynamoDB table for Terraform State Locks
#   3. S3 bucket for Deploy Artifacts
# ==============================================================================

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"

echo "🔍 Checking AWS Identity..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "✅ AWS Account ID: $ACCOUNT_ID"
echo "✅ Target Region:   $REGION"

STATE_BUCKET="scaleops-tf-state-$ACCOUNT_ID"
ARTIFACT_BUCKET="scaleops-artifacts-$ACCOUNT_ID"
LOCK_TABLE="scaleops-tf-locks"

echo ""
echo "🚀 1. Creating Terraform State S3 Bucket: $STATE_BUCKET"
if [ "$REGION" = "us-east-1" ]; then
  aws s3api create-bucket --bucket "$STATE_BUCKET" --region "$REGION" 2>/dev/null || true
else
  aws s3api create-bucket --bucket "$STATE_BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" 2>/dev/null || true
fi
aws s3api put-bucket-versioning --bucket "$STATE_BUCKET" --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket "$STATE_BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket "$STATE_BUCKET" \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "✅ State Bucket Ready!"

echo ""
echo "🚀 2. Creating DynamoDB State Lock Table: $LOCK_TABLE"
if ! aws dynamodb describe-table --table-name "$LOCK_TABLE" --region "$REGION" >/dev/null 2>&1; then
  aws dynamodb create-table \
    --table-name "$LOCK_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" >/dev/null
  echo "✅ Lock Table created!"
else
  echo "✅ Lock Table already exists."
fi

echo ""
echo "🚀 3. Creating Artifact S3 Bucket: $ARTIFACT_BUCKET"
if [ "$REGION" = "us-east-1" ]; then
  aws s3api create-bucket --bucket "$ARTIFACT_BUCKET" --region "$REGION" 2>/dev/null || true
else
  aws s3api create-bucket --bucket "$ARTIFACT_BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" 2>/dev/null || true
fi
aws s3api put-bucket-versioning --bucket "$ARTIFACT_BUCKET" --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket "$ARTIFACT_BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket "$ARTIFACT_BUCKET" \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "✅ Artifact Bucket Ready!"

echo ""
echo "=============================================================================="
echo "🎉 ALL AWS PREREQUISITES CREATED SUCCESSFULLY!"
echo "=============================================================================="
echo ""
echo "Now configure your GitHub Repository Settings:"
echo ""
echo "[A] Secrets (Settings -> Secrets and variables -> Actions -> Secrets):"
echo "    AWS_ACCESS_KEY_ID      = <Your IAM Access Key ID>"
echo "    AWS_SECRET_ACCESS_KEY  = <Your IAM Secret Access Key>"
echo ""
echo "[B] Variables (Settings -> Secrets and variables -> Actions -> Variables):"
echo "    AWS_REGION             = $REGION"
echo "    TF_STATE_BUCKET        = $STATE_BUCKET"
echo "    TF_STATE_KEY           = scaleops-demo/terraform.tfstate"
echo "    TF_STATE_LOCK_TABLE    = $LOCK_TABLE"
echo "    DEPLOY_ARTIFACT_BUCKET = $ARTIFACT_BUCKET"
echo "=============================================================================="
