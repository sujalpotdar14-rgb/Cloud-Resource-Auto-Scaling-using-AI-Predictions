# Production Dockerfile for AWS Lambda Container or ECS / App Runner
FROM public.ecr.aws/lambda/python:3.12

# Copy requirements and install dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt --no-cache-dir

# Copy application function code
COPY lambda_function.py ${LAMBDA_TASK_ROOT}

# Set AWS Lambda handler
CMD [ "lambda_function.lambda_handler" ]
