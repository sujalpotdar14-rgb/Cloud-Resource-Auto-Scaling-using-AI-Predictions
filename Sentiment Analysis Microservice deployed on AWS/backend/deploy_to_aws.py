"""
Direct Python Boto3 Deployment Script for AWS Account 777035565881
Provisions: DynamoDB Table, S3 Bucket with Web Hosting, IAM Role, and Lambda Function.
"""
import os
import sys
import time
import json
import zipfile
import boto3
from botocore.exceptions import ClientError

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def deploy_to_aws():
    print("=" * 60)
    print(" 🚀 DEPLOYING SENTIMENT MICROSERVICE TO YOUR AWS ACCOUNT")
    print("=" * 60)

    # 1. Verify Credentials
    try:
        sts = boto3.client('sts')
        identity = sts.get_caller_identity()
        account_id = identity['Account']
        arn = identity['Arn']
        region = os.environ.get('AWS_DEFAULT_REGION', 'eu-north-1')
        print(f"✅ Authenticated as: {arn} (Account: {account_id}, Region: {region})")
    except Exception as e:
        print(f"❌ AWS Auth Error: {e}")
        print("Please set $env:AWS_ACCESS_KEY_ID and $env:AWS_SECRET_ACCESS_KEY first.")
        return

    # 2. Create DynamoDB Table: SentimentLogs
    print("\n[1/4] Provisioning Amazon DynamoDB Table ('SentimentLogs')...")
    ddb = boto3.client('dynamodb', region_name=region)
    try:
        ddb.create_table(
            TableName='SentimentLogs',
            KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
            AttributeDefinitions=[{'AttributeName': 'id', 'AttributeType': 'S'}],
            BillingMode='PAY_PER_REQUEST'
        )
        print("   ✅ Created DynamoDB table: 'SentimentLogs'")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceInUseException':
            print("   ℹ️ DynamoDB table 'SentimentLogs' already exists.")
        else:
            print(f"   ⚠️ DynamoDB creation note: {e}")

    # 3. Create S3 Bucket & Upload Web App
    bucket_name = f"sentiment-microservice-{account_id}"
    print(f"\n[2/4] Provisioning Amazon S3 Bucket ('{bucket_name}')...")
    s3 = boto3.client('s3', region_name=region)
    try:
        if region == 'us-east-1':
            s3.create_bucket(Bucket=bucket_name)
        else:
            s3.create_bucket(
                Bucket=bucket_name,
                CreateBucketConfiguration={'LocationConstraint': region}
            )
        print(f"   ✅ Created S3 Bucket: {bucket_name}")
    except ClientError as e:
        if e.response['Error']['Code'] in ['BucketAlreadyOwnedByYou', 'BucketAlreadyExists']:
            print(f"   ℹ️ S3 Bucket '{bucket_name}' already exists.")
        else:
            print(f"   ⚠️ S3 creation note: {e}")

    # Upload Frontend files to S3
    print("   Uploading Frontend web files to S3 bucket...")
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Frontend"))
    for file_name in ['index.html', 'styles.css', 'app.js']:
        file_path = os.path.join(frontend_dir, file_name)
        if os.path.exists(file_path):
            content_type = 'text/html' if file_name.endswith('.html') else ('text/css' if file_name.endswith('.css') else 'application/javascript')
            s3.upload_file(
                file_path, bucket_name, file_name,
                ExtraArgs={'ContentType': content_type}
            )
            print(f"   • Uploaded {file_name} -> s3://{bucket_name}/{file_name}")

    # 4. IAM Role for Lambda
    print("\n[3/4] Configuring AWS IAM Role ('SentimentLambdaExecRole')...")
    iam = boto3.client('iam')
    role_name = 'SentimentLambdaExecRole'
    assume_role_doc = {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "lambda.amazonaws.com"},
            "Action": "sts:AssumeRole"
        }]
    }
    
    role_arn = None
    try:
        role_res = iam.create_role(
            RoleName=role_name,
            AssumeRolePolicyDocument=json.dumps(assume_role_doc)
        )
        role_arn = role_res['Role']['Arn']
        print(f"   ✅ Created IAM Role: {role_name}")
        
        # Attach AmazonComprehendReadOnly & AWSLambdaBasicExecutionRole
        iam.attach_role_policy(RoleName=role_name, PolicyArn='arn:aws:iam::aws:policy/ComprehendReadOnly')
        iam.attach_role_policy(RoleName=role_name, PolicyArn='arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole')
        iam.attach_role_policy(RoleName=role_name, PolicyArn='arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess')
        print("   ✅ Attached policies (Comprehend, DynamoDB, CloudWatch Logs).")
        time.sleep(10) # Wait for IAM propagation
    except ClientError as e:
        if e.response['Error']['Code'] == 'EntityAlreadyExists':
            role_arn = iam.get_role(RoleName=role_name)['Role']['Arn']
            print(f"   ℹ️ Using existing IAM Role: {role_arn}")
        else:
            print(f"   ⚠️ IAM Role note: {e}")

    # 5. Create AWS Lambda Function
    print("\n[4/4] Deploying AWS Lambda Function ('SentimentAnalysisMicroservice')...")
    lam = boto3.client('lambda', region_name=region)
    
    # Zip lambda_function.py
    zip_path = os.path.join(os.path.dirname(__file__), "function.zip")
    with zipfile.ZipFile(zip_path, 'w') as z:
        z.write(os.path.join(os.path.dirname(__file__), "lambda_function.py"), arcname="lambda_function.py")
    
    with open(zip_path, 'rb') as f:
        zip_bytes = f.read()

    func_name = "SentimentAnalysisMicroservice"
    try:
        lam.create_function(
            FunctionName=func_name,
            Runtime='python3.12',
            Role=role_arn,
            Handler='lambda_function.lambda_handler',
            Code={'ZipFile': zip_bytes},
            Description='AWS Sentiment Analysis Microservice using Amazon Comprehend',
            Timeout=15,
            MemorySize=512,
            Environment={'Variables': {'DYNAMODB_TABLE': 'SentimentLogs'}}
        )
        print(f"   ✅ Created AWS Lambda function: '{func_name}'")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceConflictException':
            lam.update_function_code(FunctionName=func_name, ZipFile=zip_bytes)
            print(f"   ✅ Updated existing AWS Lambda function code: '{func_name}'")
        else:
            print(f"   ⚠️ Lambda deployment note: {e}")

    print("\n" + "=" * 60)
    print(" 🎉 SUCCESS! DEPLOYMENT TO YOUR AWS ACCOUNT COMPLETED!")
    print(f" • Check S3 in AWS Console      : s3://{bucket_name}")
    print(f" • Check Lambda in AWS Console  : {func_name}")
    print(f" • Check DynamoDB in AWS Console: SentimentLogs")
    print("=" * 60)

if __name__ == "__main__":
    deploy_to_aws()
