"""
FastAPI Backend Server for Cloud Resource Auto-Scaling using AI Predictions.
Serves REST API endpoints, real-time workload simulator, and static web dashboard files.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import time
import math
import numpy as np
from typing import Dict, List, Any, Optional

from ai_engine import WorkloadPredictor, AutoScalerPolicy
from aws_controller import AWSController

app = FastAPI(
    title="Cloud Resource Auto-Scaling with AI Predictions",
    description="Zero-Cost AWS Auto-Scaling driven by AI Machine Learning Predictions",
    version="1.0.0"
)

# Enable CORS for local web interface
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize core system modules
predictor = WorkloadPredictor()
autoscaler = AutoScalerPolicy(target_cpu=65.0, min_instances=2, max_instances=10, cooldown_sec=20)
aws_ctrl = AWSController()

# State variables
current_workload_pattern = "normal"  # "normal", "flash_sale", "ddos", "sinusoidal", "low_night"
scaling_strategy_mode = "ai_predictive"  # "ai_predictive" or "reactive"
event_logs: List[Dict[str, Any]] = []
telemetry_history: List[Dict[str, Any]] = []
system_start_time = time.time()

# Request schemas
class AWSConfigReq(BaseModel):
    access_key: str = ""
    secret_key: str = ""
    region: str = "ap-south-1"

class WorkloadSimReq(BaseModel):
    pattern: str  # "normal", "flash_sale", "ddos", "sinusoidal", "low_night"

class ScalingModeReq(BaseModel):
    mode: str  # "ai_predictive" or "reactive"

def log_event(event_type: str, title: str, description: str, metadata: Optional[Dict[str, Any]] = None):
    """Appends an item to the event audit log feed."""
    entry = {
        'id': f"evt_{int(time.time() * 1000)}",
        'timestamp': time.strftime('%H:%M:%S'),
        'epoch': time.time(),
        'type': event_type,  # "SCALE_OUT", "SCALE_IN", "PREDICTION", "AWS_EVENT", "ALERT"
        'title': title,
        'description': description,
        'metadata': metadata or {}
    }
    event_logs.insert(0, entry)
    if len(event_logs) > 100:
        event_logs.pop()

# Initialize log with welcome message
log_event("SYSTEM", "System Initialized", "AI Auto-Scaler Engine active under ₹0 AWS Free Tier Guarantee.")

def generate_current_cpu_load() -> Tuple[float, int]:
    """Generates dynamic CPU load & request rate based on active pattern and instance count."""
    elapsed = time.time() - system_start_time
    instances = aws_ctrl.local_emulator.desired_capacity
    
    base_load = 40.0
    
    if current_workload_pattern == "normal":
        # Mild sine wave + noise
        base_load = 35.0 + 15.0 * math.sin(elapsed / 20.0) + np.random.normal(0, 2)
    elif current_workload_pattern == "flash_sale":
        # Sudden massive spike (+300% load)
        t = (elapsed % 60)
        if t < 30:
            base_load = 85.0 + 10.0 * math.sin(t / 5.0) + np.random.normal(0, 3)
        else:
            base_load = 45.0 + np.random.normal(0, 3)
    elif current_workload_pattern == "ddos":
        # High erratic CPU
        base_load = 92.0 + np.random.normal(0, 4)
    elif current_workload_pattern == "sinusoidal":
        # Smooth high and low wave
        base_load = 50.0 + 35.0 * math.sin(elapsed / 15.0)
    elif current_workload_pattern == "low_night":
        # Quiet period
        base_load = 15.0 + np.random.normal(0, 1.5)

    base_load = max(5.0, min(99.0, base_load))
    
    # Effective CPU load drops when instance capacity increases!
    # Base load is total incoming demand. Distributed across instance fleet:
    effective_cpu = (base_load * 2.0) / max(1, instances)
    effective_cpu = max(8.0, min(98.0, effective_cpu))
    
    request_rate = int(base_load * 25 + np.random.randint(-15, 15))
    return round(float(effective_cpu), 2), request_rate

@app.get("/api/status")
def get_system_status():
    """Main status endpoint polled by dashboard UI."""
    now = time.time()
    current_instances = aws_ctrl.local_emulator.desired_capacity
    cpu_load, req_rate = generate_current_cpu_load()
    
    # Add metric sample to ML predictor buffer
    predictor.add_metric_point(now, cpu_load, req_rate, current_instances)
    
    # Generate AI forecast for next 15 mins
    ai_forecast = predictor.predict_horizon(horizon_minutes=15)
    
    # Evaluate auto-scaling policy
    policy_decision = autoscaler.evaluate_policy(
        current_instances=current_instances,
        current_cpu=cpu_load,
        ai_forecast=ai_forecast,
        mode=scaling_strategy_mode
    )
    
    # Execute scaling if needed
    if policy_decision['action'] in ["SCALE_OUT", "SCALE_IN"]:
        scale_res = aws_ctrl.execute_scaling_action(
            target_capacity=policy_decision['recommended_instances'],
            reason=policy_decision['reason']
        )
        aws_ctrl.publish_cloudwatch_metric("AIPredictedCapacity", policy_decision['recommended_instances'])
        log_event(
            policy_decision['action'],
            f"Fleet Scaled to {policy_decision['recommended_instances']} Instances",
            policy_decision['reason'],
            metadata=scale_res
        )

    # Publish CPU metric to CloudWatch (Free Tier)
    aws_ctrl.publish_cloudwatch_metric("CPUUtilization", cpu_load)
    
    # Record telemetry point
    telemetry_point = {
        'timestamp': time.strftime('%H:%M:%S'),
        'epoch': now,
        'cpu_utilization': cpu_load,
        'predicted_cpu_15m': ai_forecast['max_predicted_cpu'],
        'request_rate': req_rate,
        'instances': current_instances,
        'target_instances': policy_decision['recommended_instances']
    }
    telemetry_history.append(telemetry_point)
    if len(telemetry_history) > 60:
        telemetry_history.pop(0)

    fleet_info = aws_ctrl.get_fleet_status()

    return {
        'timestamp': now,
        'formatted_time': time.strftime('%Y-%m-%d %H:%M:%S'),
        'current_cpu': cpu_load,
        'request_rate': req_rate,
        'active_instances': current_instances,
        'recommended_instances': policy_decision['recommended_instances'],
        'scaling_strategy_mode': scaling_strategy_mode,
        'workload_pattern': current_workload_pattern,
        'ai_forecast': ai_forecast,
        'policy_decision': policy_decision,
        'fleet': fleet_info,
        'zero_cost_status': fleet_info['zero_cost_compliance']
    }

@app.get("/api/telemetry")
def get_telemetry_history():
    """Returns past 60 data points for real-time charts."""
    return {'telemetry': telemetry_history}

@app.post("/api/simulate-workload")
def set_workload_simulation(req: WorkloadSimReq):
    """Changes traffic workload simulation pattern."""
    global current_workload_pattern
    valid_patterns = ["normal", "flash_sale", "ddos", "sinusoidal", "low_night"]
    if req.pattern not in valid_patterns:
        raise HTTPException(status_code=400, detail=f"Invalid pattern. Choose from {valid_patterns}")
    
    current_workload_pattern = req.pattern
    log_event(
        "SIMULATION",
        f"Workload Pattern Changed to '{req.pattern.upper()}'",
        f"Traffic generator updated. AI prediction engine adapting forecast models."
    )
    return {'status': 'SUCCESS', 'pattern': current_workload_pattern}

@app.post("/api/autoscale/toggle-mode")
def set_scaling_mode(req: ScalingModeReq):
    """Switches auto-scaling mode between AI Predictive (Proactive) and Reactive (Lagging)."""
    global scaling_strategy_mode
    if req.mode not in ["ai_predictive", "reactive"]:
        raise HTTPException(status_code=400, detail="Mode must be 'ai_predictive' or 'reactive'")
    
    scaling_strategy_mode = req.mode
    log_event(
        "MODE_CHANGE",
        f"Auto-Scaling Mode Set to {req.mode.upper()}",
        f"Switched scaling strategy to {'AI Proactive Prediction' if req.mode == 'ai_predictive' else 'Reactive CPU Threshold'}."
    )
    return {'status': 'SUCCESS', 'mode': scaling_strategy_mode}

@app.post("/api/aws/config")
def configure_aws(req: AWSConfigReq):
    """Configures AWS account credentials under strict ₹0 Cost Protection Guard."""
    res = aws_ctrl.configure_aws_credentials(
        access_key=req.access_key,
        secret_key=req.secret_key,
        region=req.region
    )
    log_event(
        "AWS_CONFIG",
        f"AWS Mode: {res['mode']}",
        res['message'],
        metadata=res
    )
    return res

@app.get("/api/events")
def get_events():
    """Returns event log history."""
    return {'events': event_logs}

# Mount static web UI files
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/", response_class=HTMLResponse)
def index_html():
    """Serves the main web dashboard dashboard HTML."""
    html_path = os.path.join(static_dir, "index.html")
    if os.path.exists(html_path):
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>Cloud Resource Auto-Scaling Dashboard</h1><p>Static UI loading...</p>"

if __name__ == "__main__":
    print("Starting Cloud Resource Auto-Scaling AI Server on http://localhost:8000 ...")
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
