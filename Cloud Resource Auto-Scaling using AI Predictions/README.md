# Cloud Resource Auto-Scaling using AI Predictions 🚀
> **Guaranteed 0 Rupees ($0.00) AWS Cost | Proactive Time-Series ML Auto-Scaling Engine**

This project delivers an enterprise-grade **Cloud Resource Predictive Auto-Scaling System** driven by **Machine Learning (Ensemble RandomForest + Ridge Time-Series Regression)**. 

Unlike traditional reactive auto-scaling policies (which wait for CPU load to spike and cause HTTP 503 latency errors during cold starts), this system **predicts workload peaks 15 to 30 minutes in advance** and **pre-warms server capacity proactive before demand spikes occur**.

---

## 🛡️ ₹0.00 (Zero-Cost) AWS Assurance Guarantee

The user explicitly requested **₹0 (0 Rupees / 0 Dollar Cost)** while supporting AWS account integration. This project implements a **Dual Mode Architecture with Strict Zero-Cost Guards**:

1. **Local AWS Emulator Mode (Default)**:
   - Operates **100% locally** on your machine with zero AWS credentials required.
   - Simulates AWS EC2 instance nodes (`t3.micro`), Auto Scaling Groups (ASG), CloudWatch Metrics, and scale-in/scale-out events.
   - **Cost: Exactly ₹0.00 / $0.00**.

2. **AWS Free Tier Live Account Integration Mode**:
   - Optionally connect your real AWS Access Key / Secret Key.
   - Uses **AWS Free Tier Services ONLY**:
     - **CloudWatch Metrics**: Custom metrics under namespace `AIAutoScaling/ZeroCost` (< 10 free metrics/month).
     - **AWS Lambda & DynamoDB**: Free Tier quotas (1,000,000 free requests/month).
     - **AWS Auto Scaling Group Dry-Run Mode**: Evaluates scale-out decisions without spawning paid EC2 instances or Application Load Balancers.
   - **Cost Protection Guard (`AWSZeroCostGuard`)**: Blocks any attempt to create paid infrastructure (NAT Gateways, ALBs, SageMaker Endpoints, or paid EC2 instances).

---

## 🌟 Key Features

- **AI Time-Series Prediction Engine (`ai_engine.py`)**:
  - Supervised learning on historical CPU, request count, and temporal lag/rolling features.
  - Generates forecasted workload curves 15-30 minutes into the future with confidence margins.
  - Proactive pre-warming lead time calculation: scales out fleet 10-15 mins before predicted peak.
- **Proactive vs Reactive Scaling Comparison**:
  - Interactive strategy toggle to see real-time performance difference between proactive AI scaling and reactive threshold scaling.
- **Workload Pattern Generator**:
  - Simulate traffic patterns in real-time: *Normal Traffic*, *Flash Sale Surge (+300%)*, *DDoS Spike*, *Diurnal Sine Wave*, and *Off-Peak Low Load*.
- **Interactive Glassmorphic Visual Dashboard**:
  - Real-time dual line chart (Actual CPU vs AI Predicted Peak vs Target CPU threshold).
  - Active EC2 Instance Fleet Visualizer displaying live server nodes with glowing status indicators.
  - Live terminal-style audit event feed streaming scaling triggers, confidence scores, and reasons.

---

## 🛠️ Project Architecture

```
Cloud Resource Auto-Scaling using AI Predictions/
├── ai_engine.py         # Machine Learning Time-Series Predictor & Policy Evaluator
├── aws_controller.py    # AWS Boto3 Integration + Zero-Cost Guard & Local AWS Emulator
├── server.py            # FastAPI REST & Telemetry Server
├── run_app.py           # One-Click Application Launcher
├── requirements.txt     # Python Dependencies
├── static/
│   ├── index.html       # Modern Glassmorphic Web Dashboard UI
│   ├── style.css        # Neon Dark CSS Styling & Animations
│   └── app.js           # Chart.js & Real-time Controller
└── README.md            # Comprehensive Architecture & Setup Guide
```

---

## 🚀 How to Run the Project

### Option A: One-Click Launcher (Recommended)
Run the launcher script:
```bash
python run_app.py
```
This starts the FastAPI server at `http://localhost:8000` and automatically opens the dashboard in your default browser!

### Option B: Manual Command
```bash
python server.py
```
Then open your browser to [http://localhost:8000](http://localhost:8000).

---

## ⚙️ Connecting Your AWS Account (Optional & Safe)

1. Open the dashboard at `http://localhost:8000`.
2. Click **Connect AWS Account** in the top header.
3. Select your preferred **AWS Region** (e.g., `ap-south-1` Mumbai).
4. Enter your AWS Access Key ID and Secret Access Key (or leave empty to stay in Local Emulator Mode).
5. Click **Validate & Connect AWS**. The zero-cost guard will verify your credentials and operate safely under Free Tier limits!
