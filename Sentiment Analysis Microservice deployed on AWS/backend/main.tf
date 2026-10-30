terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default     = "us-east-1"
  description = "AWS Region for deployment"
}

# DynamoDB Table
resource "aws_dynamodb_table" "sentiment_logs" {
  name         = "SentimentLogs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Environment = "Production"
    Project     = "SentimentAnalysisMicroservice"
  }
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_exec" {
  name = "sentiment_analysis_lambda_exec_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# IAM Policy for CloudWatch Logs & Comprehend
resource "aws_iam_policy" "lambda_permissions" {
  name        = "sentiment_lambda_permissions"
  description = "Allows Lambda to write CloudWatch logs and invoke Amazon Comprehend"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "comprehend:DetectSentiment",
          "comprehend:DetectKeyPhrases"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem"
        ]
        Resource = aws_dynamodb_table.sentiment_logs.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "attach_permissions" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_permissions.arn
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.sentiment_logs.name
}
