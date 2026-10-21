terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  backend "s3" {
    # Configured via CLI flags or environment variables
    # terraform init \
    #   -backend-config="bucket=${TF_STATE_BUCKET}" \
    #   -backend-config="key=${TF_STATE_KEY}" \
    #   -backend-config="region=${AWS_REGION}" \
    #   -backend-config="encrypt=true" \
    #   -backend-config="dynamodb_table=${TF_STATE_LOCK_TABLE}"
  }
}
