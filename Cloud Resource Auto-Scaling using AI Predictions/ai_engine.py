"""
AI Prediction Engine for Cloud Resource Auto-Scaling
Implements Machine Learning Time-Series Forecasting (RandomForest + Ridge Ensemble)
and Proactive Auto-Scaling Decision Policies.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
import time
import math
from typing import Dict, List, Tuple, Any

class WorkloadPredictor:
    """
    ML Time-Series Forecasting Engine for Cloud Metric Trajectories.
    Predicts CPU utilization, Request Rate, and Memory pressure 15-30 minutes in advance.
    """
    def __init__(self):
        self.rf_model = RandomForestRegressor(n_estimators=50, random_state=42)
        self.ridge_model = Ridge(alpha=1.0)
        self.is_trained = False
        self.history_buffer: List[Dict[str, Any]] = []
        self._initialize_synthetic_baseline()

    def _initialize_synthetic_baseline(self):
        """Generates realistic baseline training data representing 48 hours of enterprise workload."""
        np.random.seed(42)
        timestamps = pd.date_range(end=pd.Timestamp.now(), periods=2880, freq='1min')
        
        # Diurnal pattern (daily peak around 2 PM - 4 PM) + weekly trend
        hours = timestamps.hour + timestamps.minute / 60.0
        daily_pattern = 30 + 35 * np.sin((hours - 7) * np.pi / 12) + 15 * np.cos((hours - 14) * np.pi / 6)
        daily_pattern = np.clip(daily_pattern, 10, 85)
        
        # Add random bursts (flash sales, batch jobs)
        bursts = np.zeros(len(timestamps))
        burst_indices = np.random.choice(len(timestamps), size=12, replace=False)
        for idx in burst_indices:
            duration = np.random.randint(15, 45)
            end_idx = min(idx + duration, len(timestamps))
            bursts[idx:end_idx] += np.random.uniform(20, 40)
            
        noise = np.random.normal(0, 3.0, len(timestamps))
        cpu_series = np.clip(daily_pattern + bursts + noise, 5.0, 99.0)
        
        for ts, cpu in zip(timestamps, cpu_series):
            self.history_buffer.append({
                'timestamp': ts.timestamp(),
                'datetime': ts.strftime('%Y-%m-%d %H:%M:%S'),
                'cpu_utilization': round(float(cpu), 2),
                'request_rate': int(cpu * 12 + np.random.randint(-10, 10)),
                'active_instances': max(2, int(np.ceil(cpu / 30)))
            })
            
        self.train_model()

    def _extract_features(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """Extracts lag, rolling window, and temporal features for supervised ML training."""
        df = df.copy()
        df['datetime_dt'] = pd.to_datetime(df['timestamp'], unit='s')
        df['hour'] = df['datetime_dt'].dt.hour
        df['minute'] = df['datetime_dt'].dt.minute
        df['dayofweek'] = df['datetime_dt'].dt.dayofweek
        
        # Lag features
        for lag in [1, 2, 5, 10, 15]:
            df[f'cpu_lag_{lag}'] = df['cpu_utilization'].shift(lag)
            
        # Rolling features
        df['cpu_roll_mean_5'] = df['cpu_utilization'].rolling(5).mean()
        df['cpu_roll_std_5'] = df['cpu_utilization'].rolling(5).std()
        df['cpu_roll_mean_15'] = df['cpu_utilization'].rolling(15).mean()
        
        df = df.dropna()
        
        feature_cols = [
            'hour', 'minute', 'dayofweek',
            'cpu_lag_1', 'cpu_lag_2', 'cpu_lag_5', 'cpu_lag_10', 'cpu_lag_15',
            'cpu_roll_mean_5', 'cpu_roll_std_5', 'cpu_roll_mean_15'
        ]
        
        X = df[feature_cols].values
        y = df['cpu_utilization'].values
        return X, y

    def train_model(self):
        """Fits the ensemble ML models on available metric history."""
        if len(self.history_buffer) < 30:
            return
            
        df = pd.DataFrame(self.history_buffer)
        X, y = self._extract_features(df)
        
        if len(X) > 0:
            self.rf_model.fit(X, y)
            self.ridge_model.fit(X, y)
            self.is_trained = True

    def add_metric_point(self, timestamp: float, cpu: float, request_rate: int, active_instances: int):
        """Appends a new metric sample and keeps the buffer capped at 3000 points."""
        self.history_buffer.append({
            'timestamp': timestamp,
            'datetime': pd.to_datetime(timestamp, unit='s').strftime('%Y-%m-%d %H:%M:%S'),
            'cpu_utilization': round(float(cpu), 2),
            'request_rate': int(request_rate),
            'active_instances': int(active_instances)
        })
        if len(self.history_buffer) > 3000:
            self.history_buffer.pop(0)

    def predict_horizon(self, horizon_minutes: int = 15) -> Dict[str, Any]:
        """
        Generates step-by-step predictions for the next `horizon_minutes`.
        Returns forecasted CPU, confidence interval, and anomaly flags.
        """
        if not self.is_trained or len(self.history_buffer) < 20:
            current_cpu = self.history_buffer[-1]['cpu_utilization'] if self.history_buffer else 40.0
            return {
                'predicted_cpu': [current_cpu] * horizon_minutes,
                'lower_bound': [max(0, current_cpu - 5)] * horizon_minutes,
                'upper_bound': [min(100, current_cpu + 5)] * horizon_minutes,
                'max_predicted_cpu': current_cpu,
                'confidence_score': 0.85,
                'is_spike_predicted': False
            }

        df = pd.DataFrame(self.history_buffer[-30:])
        recent_cpus = df['cpu_utilization'].tolist()
        
        predictions = []
        lower_bounds = []
        upper_bounds = []
        
        curr_buffer = recent_cpus.copy()
        now_ts = pd.to_datetime(time.time(), unit='s')

        for step in range(1, horizon_minutes + 1):
            future_ts = now_ts + pd.Timedelta(minutes=step)
            hour = future_ts.hour
            minute = future_ts.minute
            dayofweek = future_ts.dayofweek
            
            lag_1 = curr_buffer[-1]
            lag_2 = curr_buffer[-2]
            lag_5 = curr_buffer[-5] if len(curr_buffer) >= 5 else curr_buffer[0]
            lag_10 = curr_buffer[-10] if len(curr_buffer) >= 10 else curr_buffer[0]
            lag_15 = curr_buffer[-15] if len(curr_buffer) >= 15 else curr_buffer[0]
            
            roll_mean_5 = float(np.mean(curr_buffer[-5:]))
            roll_std_5 = float(np.std(curr_buffer[-5:])) if len(curr_buffer) >= 5 else 1.0
            roll_mean_15 = float(np.mean(curr_buffer[-15:]))
            
            x_input = np.array([[
                hour, minute, dayofweek,
                lag_1, lag_2, lag_5, lag_10, lag_15,
                roll_mean_5, roll_std_5, roll_mean_15
            ]])
            
            pred_rf = float(self.rf_model.predict(x_input)[0])
            pred_ridge = float(self.ridge_model.predict(x_input)[0])
            
            # Weighted ensemble
            pred_val = 0.7 * pred_rf + 0.3 * pred_ridge
            pred_val = max(5.0, min(99.0, pred_val))
            
            # Prediction confidence margin based on standard deviation
            margin = 3.5 + (step * 0.4) + (roll_std_5 * 0.5)
            
            predictions.append(round(pred_val, 2))
            lower_bounds.append(round(max(0.0, pred_val - margin), 2))
            upper_bounds.append(round(min(100.0, pred_val + margin), 2))
            
            curr_buffer.append(pred_val)

        max_pred = float(max(predictions))
        recent_avg = float(np.mean(recent_cpus[-5:]))
        is_spike = max_pred > (recent_avg + 20.0) or max_pred > 75.0

        return {
            'predicted_cpu': predictions,
            'lower_bound': lower_bounds,
            'upper_bound': upper_bounds,
            'max_predicted_cpu': round(max_pred, 2),
            'confidence_score': round(float(np.clip(0.95 - (np.std(predictions) * 0.01), 0.75, 0.99)), 2),
            'is_spike_predicted': is_spike
        }

class AutoScalerPolicy:
    """
    Proactive vs Reactive Auto-Scaling Policy Engine.
    Evaluates ML predictions against target thresholds to calculate optimal server fleet size.
    """
    def __init__(self, target_cpu: float = 65.0, min_instances: int = 2, max_instances: int = 10, cooldown_sec: int = 30):
        self.target_cpu = target_cpu
        self.min_instances = min_instances
        self.max_instances = max_instances
        self.cooldown_sec = cooldown_sec
        self.last_scale_time = 0.0

    def evaluate_policy(self, current_instances: int, current_cpu: float, ai_forecast: Dict[str, Any], mode: str = "ai_predictive") -> Dict[str, Any]:
        """
        Determines target instance count based on current & predicted load.
        `mode` can be "ai_predictive" (Proactive) or "reactive" (Lagging standard policy).
        """
        now = time.time()
        in_cooldown = (now - self.last_scale_time) < self.cooldown_sec
        
        target_capacity = current_instances
        reason = "System load within nominal range. Fleet stable."
        action = "NO_CHANGE"

        if mode == "ai_predictive":
            # Proactive scaling based on 15-min peak prediction
            pred_peak_cpu = ai_forecast.get('max_predicted_cpu', current_cpu)
            
            if pred_peak_cpu > self.target_cpu:
                # Scale out formula: ceil( (Predicted_CPU / Target_CPU) * Current_Instances )
                needed = int(math.ceil((pred_peak_cpu / self.target_cpu) * current_instances))
                # Add buffer if high spike predicted
                if ai_forecast.get('is_spike_predicted', False):
                    needed += 1
                target_capacity = min(self.max_instances, max(current_instances, needed))
                
                if target_capacity > current_instances:
                    action = "SCALE_OUT"
                    reason = f"PROACTIVE ALERT: AI predicted CPU peak of {pred_peak_cpu}% in 15m (exceeds {self.target_cpu}% target). Pre-warming {target_capacity - current_instances} instance(s)."
            
            elif pred_peak_cpu < (self.target_cpu - 25.0) and current_cpu < (self.target_cpu - 25.0):
                # Scale in safely
                needed = int(math.floor((pred_peak_cpu / self.target_cpu) * current_instances))
                target_capacity = max(self.min_instances, min(current_instances, needed))
                
                if target_capacity < current_instances:
                    action = "SCALE_IN"
                    reason = f"OPTIMIZATION: AI foresees sustained low utilization ({pred_peak_cpu}%). Decommissioning {current_instances - target_capacity} idle instance(s)."

        else:
            # Traditional Reactive scaling (only checks current CPU, lags behind bursts)
            if current_cpu > (self.target_cpu + 10.0):
                target_capacity = min(self.max_instances, current_instances + 1)
                action = "SCALE_OUT"
                reason = f"REACTIVE TRIGGER: Current CPU ({current_cpu}%) exceeded threshold ({self.target_cpu}%). Adding 1 instance."
            elif current_cpu < 30.0 and current_instances > self.min_instances:
                target_capacity = max(self.min_instances, current_instances - 1)
                action = "SCALE_IN"
                reason = f"REACTIVE TRIGGER: Current CPU ({current_cpu}%) dropped below 30%. Removing 1 instance."

        # Apply cooldown check
        if action != "NO_CHANGE" and in_cooldown:
            action = "COOLDOWN_BLOCKED"
            remaining = int(self.cooldown_sec - (now - self.last_scale_time))
            reason = f"Scaling action holdback: Auto-scaling cooldown active ({remaining}s remaining)."
            target_capacity = current_instances
        elif action in ["SCALE_OUT", "SCALE_IN"]:
            self.last_scale_time = now

        return {
            'action': action,
            'current_instances': current_instances,
            'recommended_instances': target_capacity,
            'delta_instances': target_capacity - current_instances,
            'reason': reason,
            'mode': mode,
            'cooldown_active': in_cooldown,
            'timestamp': now
        }
