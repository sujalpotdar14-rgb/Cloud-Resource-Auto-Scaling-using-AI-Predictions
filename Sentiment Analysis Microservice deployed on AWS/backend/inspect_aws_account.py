"""
AWS Account Resource Inspector Script
Inspects AWS Account Identity, S3, Lambda, DynamoDB, EC2, API Gateway & CloudWatch.
"""
import os
import sys
import boto3
from botocore.exceptions import NoCredentialsError, ClientError

# Fix Windows console encoding
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def inspect_aws_account():
    print("=" * 60)
    print(" [AWS ACCOUNT RESOURCE INSPECTOR]")
    print("=" * 60)

    # 1. Verify Credentials & STS Caller Identity
    try:
        sts = boto3.client('sts')
        identity = sts.get_caller_identity()
        account_id = identity.get('Account', 'Unknown')
        arn = identity.get('Arn', 'Unknown')
        user_id = identity.get('UserId', 'Unknown')
        
        session = boto3.Session()
        region = session.region_name or 'us-east-1'

        print(f"✅ AWS Credentials Verified!")
        print(f"   - Account ID : {account_id}")
        print(f"   - Identity   : {arn}")
        print(f"   - User ID    : {user_id}")
        print(f"   - Region     : {region}")
        print("-" * 60)
    except NoCredentialsError:
        print("❌ Error: No AWS Credentials found!")
        print("   Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables,")
        print("   or configure C:\\Users\\Mahadev\\.aws\\credentials")
        return
    except ClientError as e:
        print(f"❌ AWS Client Error: {e}")
        return

    # 2. Inspect S3 Buckets
    print("\n📦 [1/6] AMAZON S3 BUCKETS:")
    try:
        s3 = boto3.client('s3')
        buckets = s3.list_buckets().get('Buckets', [])
        if buckets:
            for b in buckets:
                print(f"   • {b['Name']} (Created: {b['CreationDate']})")
        else:
            print("   (No S3 buckets found in this account)")
    except Exception as e:
        print(f"   ⚠️ Could not list S3 buckets: {e}")

    # 3. Inspect AWS Lambda Functions
    print("\n⚡ [2/6] AWS LAMBDA FUNCTIONS:")
    try:
        lam = boto3.client('lambda', region_name=region)
        functions = lam.list_functions().get('Functions', [])
        if functions:
            for f in functions:
                print(f"   • {f['FunctionName']} (Runtime: {f['Runtime']}, Memory: {f['MemorySize']}MB)")
        else:
            print("   (No Lambda functions found in region " + region + ")")
    except Exception as e:
        print(f"   ⚠️ Could not list Lambda functions: {e}")

    # 4. Inspect DynamoDB Tables
    print("\n🗄️ [3/6] AMAZON DYNAMODB TABLES:")
    try:
        ddb = boto3.client('dynamodb', region_name=region)
        tables = ddb.list_tables().get('TableNames', [])
        if tables:
            for t in tables:
                print(f"   • Table: {t}")
        else:
            print("   (No DynamoDB tables found in region " + region + ")")
    except Exception as e:
        print(f"   ⚠️ Could not list DynamoDB tables: {e}")

    # 5. Inspect EC2 Instances
    print("\n🖥️ [4/6] AMAZON EC2 INSTANCES:")
    try:
        ec2 = boto3.client('ec2', region_name=region)
        reservations = ec2.describe_instances().get('Reservations', [])
        instances = []
        for r in reservations:
            instances.extend(r.get('Instances', []))
        if instances:
            for i in instances:
                instance_id = i['InstanceId']
                state = i['State']['Name']
                itype = i['InstanceType']
                print(f"   • {instance_id} [{state}] - {itype}")
        else:
            print("   (No EC2 instances found in region " + region + ")")
    except Exception as e:
        print(f"   ⚠️ Could not list EC2 instances: {e}")

    # 6. Inspect API Gateway REST APIs
    print("\n🌐 [5/6] AWS API GATEWAY REST APIs:")
    try:
        apg = boto3.client('apigateway', region_name=region)
        apis = apg.get_rest_apis().get('items', [])
        if apis:
            for a in apis:
                print(f"   • API: {a['name']} (ID: {a['id']})")
        else:
            print("   (No REST APIs found in region " + region + ")")
    except Exception as e:
        print(f"   ⚠️ Could not list API Gateway REST APIs: {e}")

    # 7. Inspect CloudWatch Log Groups
    print("\n📊 [6/6] AMAZON CLOUDWATCH LOG GROUPS:")
    try:
        cw = boto3.client('logs', region_name=region)
        groups = cw.describe_log_groups().get('logGroups', [])
        if groups:
            for g in groups[:10]:
                print(f"   • Log Group: {g['logGroupName']}")
        else:
            print("   (No CloudWatch log groups found in region " + region + ")")
    except Exception as e:
        print(f"   ⚠️ Could not list CloudWatch log groups: {e}")

    print("\n" + "=" * 60)
    print(" Inspection complete!")
    print("=" * 60)

if __name__ == "__main__":
    inspect_aws_account()
