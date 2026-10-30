"""
FastAPI Microservice implementation for local development & Docker on AWS App Runner / ECS.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import boto3

app = FastAPI(
    title="AWS Sentiment Analysis Microservice",
    description="REST API interface backed by Amazon Comprehend & DynamoDB",
    version="1.0.0"
)

# Enable CORS for frontend web application
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AWS Clients
region = os.environ.get("AWS_REGION", "us-east-1")
comprehend = boto3.client("comprehend", region_name=region)

class TextPayload(BaseModel):
    text: str
    language: str = "en"

@app.get("/")
def read_root():
    return {
        "service": "AWS Sentiment Analysis Microservice",
        "status": "ONLINE",
        "aws_region": region
    }

@app.get("/api/v1/health")
def health_check():
    return {"status": "HEALTHY", "version": "1.0.0"}

@app.post("/api/v1/analyze")
def analyze_sentiment(payload: TextPayload):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text payload cannot be empty.")
    
    try:
        res = comprehend.detect_sentiment(
            Text=payload.text,
            LanguageCode=payload.language
        )
        return {
            "status": "SUCCESS",
            "sentiment": res["Sentiment"],
            "confidence_scores": res["SentimentScore"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
