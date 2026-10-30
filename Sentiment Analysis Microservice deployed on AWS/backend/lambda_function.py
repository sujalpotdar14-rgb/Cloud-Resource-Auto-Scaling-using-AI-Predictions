import json
import os
import boto3
from datetime import datetime

# Initialize AWS SDK Boto3 Clients
region = os.environ.get('AWS_REGION', 'eu-north-1')
comprehend = boto3.client('comprehend', region_name=region)
dynamodb = boto3.resource('dynamodb', region_name=region)

TABLE_NAME = os.environ.get('DYNAMODB_TABLE', 'SentimentLogs')
table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event, context):
    """
    AWS Lambda Handler for Sentiment Analysis Microservice.
    Integrated with AWS API Gateway proxy payload.
    """
    # Handle CORS preflight OPTIONS request
    if event.get('httpMethod') == 'OPTIONS':
        return build_response(200, {'status': 'CORS OK'})

    try:
        # Parse incoming JSON body
        body = {}
        if event.get('body'):
            body = json.loads(event['body'])
        
        text = body.get('text', '').strip() if isinstance(body.get('text'), str) else ''
        
        if not text:
            return build_response(400, {'error': 'Missing required parameter "text"'})

        # Call Amazon Comprehend Sentiment Detection API
        comprehend_res = comprehend.detect_sentiment(
            Text=text,
            LanguageCode='en'
        )

        sentiment = comprehend_res.get('Sentiment', 'NEUTRAL')
        scores = comprehend_res.get('SentimentScore', {})

        request_id = getattr(context, 'aws_request_id', f"req-{int(datetime.utcnow().timestamp())}")

        # Persist log asynchronously into Amazon DynamoDB
        try:
            table.put_item(
                Item={
                    'id': request_id,
                    'timestamp': datetime.utcnow().isoformat(),
                    'sentiment': sentiment,
                    'scores': json.dumps(scores),
                    'text_snippet': text[:150],
                    'client_ip': event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')
                }
            )
        except Exception as db_err:
            print(f"DynamoDB Write Non-fatal Warning: {db_err}")

        # Return standardized JSON API response
        return build_response(200, {
            'status': 'SUCCESS',
            'sentiment': sentiment,
            'confidence_scores': {
                'Positive': round(scores.get('Positive', 0), 4),
                'Negative': round(scores.get('Negative', 0), 4),
                'Neutral': round(scores.get('Neutral', 0), 4),
                'Mixed': round(scores.get('Mixed', 0), 4)
            },
            'request_id': request_id,
            'timestamp': datetime.utcnow().isoformat()
        })

    except Exception as e:
        print(f"Unhandled Exception in Lambda: {str(e)}")
        return build_response(500, {'error': 'Internal Microservice Error', 'details': str(e)})

def build_response(status_code, body_dict):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,x-requested-with',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
        },
        'body': json.dumps(body_dict)
    }
