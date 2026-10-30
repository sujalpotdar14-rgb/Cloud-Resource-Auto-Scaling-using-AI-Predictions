#!/bin/bash
# AWS SAM Automated Deployment Script for Sentiment Analysis Microservice

echo "========================================================"
echo " Deploying Sentiment Analysis Microservice to AWS Cloud"
echo "========================================================"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed. Please install aws-cli first."
    exit 1
fi

# Build SAM Template
echo "[1/3] Building AWS SAM application package..."
sam build --template-file template.yaml

# Deploy SAM Stack
echo "[2/3] Deploying SAM stack to AWS..."
sam deploy \
  --stack-name sentiment-analysis-microservice \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset

# Retrieve Output Endpoint
echo "[3/3] Fetching deployed AWS API Gateway endpoint URL..."
ENDPOINT_URL=$(aws cloudformation describe-stacks \
  --stack-name sentiment-analysis-microservice \
  --query "Stacks[0].Outputs[?OutputKey=='SentimentApiEndpoint'].OutputValue" \
  --output text)

echo ""
echo "========================================================"
echo " DEPLOYMENT SUCCESSFUL!"
echo " Deployed AWS Endpoint URL: $ENDPOINT_URL"
echo "========================================================"
