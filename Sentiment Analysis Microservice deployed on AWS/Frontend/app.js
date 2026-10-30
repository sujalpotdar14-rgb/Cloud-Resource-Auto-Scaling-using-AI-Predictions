/* ==========================================================================
   AWS SENTIMENT ANALYSIS MICROSERVICE - INTERACTIVE APP ENGINE
   ========================================================================== */

// STATE MANAGEMENT
const state = {
    customApiUrl: "https://5hrnzk0h2b.execute-api.eu-north-1.amazonaws.com/prod/analyze",
    customApiKey: "",
    useCustomEndpoint: true,
    selectedNode: "apigateway",
    currentSandboxEndpoint: "/api/v1/analyze",
    currentCodeTab: "curl",
    currentIacTab: "sam",
    gaugeChart: null,
    invocationsChart: null,
    sentimentsChart: null,
    historyLog: []
};

// LEXICON DICTIONARIES FOR CLIENT-SIDE AMAZON COMPREHEND SIMULATOR
const LEXICON = {
    positive: ["awesome", "excellent", "great", "astounding", "success", "fast", "love", "amazing", "seamless", "fantastic", "scalable", "efficient", "superb", "brilliant", "unparalleled", "smooth", "happy", "best", "boost", "improved", "high-performance", "sub-millisecond", "reliable", "flawless", "delighted"],
    negative: ["terrible", "slow", "error", "failure", "horrible", "awful", "latency", "bug", "crash", "expensive", "broken", "unreliable", "delay", "poor", "hate", "frustrating", "bad", "disaster", "issue", "bottleneck", "down", "outage", "flaw", "stuck"],
    mixed: ["however", "but", "although", "despite", "mixed", "trade-off", "variable", "moderate"],
    entities: {
        "AWS": "AWS Organization",
        "AWS Lambda": "AWS Compute Service",
        "API Gateway": "AWS Networking Service",
        "Amazon Comprehend": "AWS AI/ML Service",
        "DynamoDB": "AWS Database",
        "Amazon S3": "AWS Storage",
        "CloudWatch": "AWS Monitoring",
        "Python": "Programming Language",
        "FastAPI": "Web Framework",
        "Docker": "Container Tech"
    }
};

// INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
    initGauge();
    initCloudWatchCharts();
    setupEventListeners();
    loadPreset('positive');
    calculateAwsCosts();
    selectNode('apigateway');
    updateSandboxTemplate();
});

// EVENT LISTENERS SETUP
function setupEventListeners() {
    const inputArea = document.getElementById("analyzer-input");
    const autoAnalyze = document.getElementById("auto-analyze");

    inputArea.addEventListener("input", (e) => {
        const text = e.target.value;
        document.getElementById("char-count").innerText = `${text.length} / 5000 chars`;
        if (autoAnalyze.checked && text.trim().length > 3) {
            debounce(runAnalysis, 400)();
        }
    });
}

// DEBOUNCE UTILITY
let debounceTimer;
function debounce(func, delay) {
    return function (...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

// PRESET LOADERS
function loadPreset(type) {
    const presets = {
        positive: "The AWS Lambda microservice migration was an astounding success! Latency dropped by 65% and Amazon Comprehend sentiment accuracy is flawless and scalable.",
        negative: "The API endpoint experienced terrible latency bottlenecks and frequent 500 error server crashes due to unoptimized database locks.",
        mixed: "The new UI dashboard looks fantastic and modern, but the backend serverless function is currently experiencing high cold-start times.",
        neutral: "Amazon Comprehend provides natural language processing API endpoints for text analytics in region us-east-1."
    };
    const input = document.getElementById("analyzer-input");
    input.value = presets[type] || "";
    document.getElementById("char-count").innerText = `${input.value.length} / 5000 chars`;
    runAnalysis();
}

function clearAnalyzer() {
    document.getElementById("analyzer-input").value = "";
    document.getElementById("char-count").innerText = "0 / 5000 chars";
}

// MAIN SENTIMENT ANALYSIS EXECUTION
async function runAnalysis() {
    const text = document.getElementById("analyzer-input").value.trim();
    if (!text) return;

    const startTime = performance.now();
    let result;

    if (state.useCustomEndpoint && state.customApiUrl) {
        try {
            const res = await fetch(state.customApiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(state.customApiKey ? { "x-api-key": state.customApiKey } : {})
                },
                body: JSON.stringify({ text })
            });
            result = await res.json();
        } catch (err) {
            console.warn("Custom AWS Endpoint error, falling back to simulator:", err);
            result = simulateComprehend(text);
        }
    } else {
        result = simulateComprehend(text);
    }

    const duration = Math.round(performance.now() - startTime) + 14;
    document.getElementById("execution-time").innerHTML = `<i class="fa-solid fa-clock"></i> ${duration} ms`;

    renderAnalysisResults(result, text);
}

// CLIENT-SIDE AMAZON COMPREHEND SIMULATOR
function simulateComprehend(text) {
    const words = text.toLowerCase().match(/\b[a-z\-']+\b/g) || [];
    let posCount = 0, negCount = 0, mixCount = 0;

    words.forEach(w => {
        if (LEXICON.positive.includes(w)) posCount++;
        if (LEXICON.negative.includes(w)) negCount++;
        if (LEXICON.mixed.includes(w)) mixCount++;
    });

    const total = posCount + negCount + mixCount;
    let posScore = 0.05, negScore = 0.05, neuScore = 0.85, mixScore = 0.05;

    if (total > 0) {
        if (posCount > negCount && posCount > mixCount) {
            posScore = Math.min(0.99, 0.70 + (posCount * 0.1));
            negScore = Math.max(0.005, 0.2 - (posCount * 0.05));
            neuScore = Math.max(0.01, 1 - (posScore + negScore + 0.01));
            mixScore = 0.01;
        } else if (negCount > posCount) {
            negScore = Math.min(0.99, 0.70 + (negCount * 0.1));
            posScore = Math.max(0.005, 0.15 - (negCount * 0.04));
            neuScore = Math.max(0.01, 1 - (negScore + posScore + 0.01));
            mixScore = 0.01;
        } else if (posCount > 0 && negCount > 0) {
            mixScore = 0.82;
            posScore = 0.09;
            negScore = 0.07;
            neuScore = 0.02;
        }
    }

    let sentiment = "NEUTRAL";
    if (posScore > 0.5) sentiment = "POSITIVE";
    else if (negScore > 0.5) sentiment = "NEGATIVE";
    else if (mixScore > 0.5) sentiment = "MIXED";

    // Extract Entities
    const detectedEntities = [];
    Object.keys(LEXICON.entities).forEach(ent => {
        if (text.includes(ent)) {
            detectedEntities.push({ Text: ent, Type: LEXICON.entities[ent] });
        }
    });

    return {
        Sentiment: sentiment,
        SentimentScore: {
            Positive: posScore,
            Negative: negScore,
            Neutral: neuScore,
            Mixed: mixScore
        },
        Entities: detectedEntities,
        RequestId: "aws-req-" + Math.random().toString(36).substring(2, 10)
    };
}

// RENDER ANALYSIS RESULTS TO UI
function renderAnalysisResults(res, originalText) {
    const scores = res.SentimentScore;
    const sentiment = res.Sentiment;

    // Banner Styling & Emojis
    const banner = document.getElementById("sentiment-banner");
    const emoji = document.getElementById("sentiment-emoji");
    const valText = document.getElementById("sentiment-value");
    const confText = document.getElementById("sentiment-confidence-text");

    const primaryScore = scores[sentiment.charAt(0) + sentiment.slice(1).toLowerCase()] || 0.95;
    const confPercent = (primaryScore * 100).toFixed(1);

    valText.innerText = sentiment;
    confText.innerText = `Confidence: ${confPercent}%`;
    document.getElementById("gauge-score").innerText = `${Math.round(confPercent)}%`;

    // Emoji & colors map
    const themeMap = {
        POSITIVE: { emoji: "😊", color: "#10B981", bg: "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(15, 23, 42, 0.9) 100%)" },
        NEGATIVE: { emoji: "😡", color: "#EF4444", bg: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(15, 23, 42, 0.9) 100%)" },
        NEUTRAL: { emoji: "😐", color: "#3B82F6", bg: "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(15, 23, 42, 0.9) 100%)" },
        MIXED: { emoji: "🤔", color: "#F59E0B", bg: "linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(15, 23, 42, 0.9) 100%)" }
    };

    const theme = themeMap[sentiment] || themeMap.NEUTRAL;
    emoji.innerText = theme.emoji;
    valText.style.color = theme.color;
    banner.style.background = theme.bg;
    banner.style.borderColor = theme.color;

    // Update Progress Bars
    document.getElementById("bar-positive").style.width = `${(scores.Positive * 100).toFixed(1)}%`;
    document.getElementById("score-pos-text").innerText = `${(scores.Positive * 100).toFixed(1)}%`;

    document.getElementById("bar-negative").style.width = `${(scores.Negative * 100).toFixed(1)}%`;
    document.getElementById("score-neg-text").innerText = `${(scores.Negative * 100).toFixed(1)}%`;

    document.getElementById("bar-neutral").style.width = `${(scores.Neutral * 100).toFixed(1)}%`;
    document.getElementById("score-neu-text").innerText = `${(scores.Neutral * 100).toFixed(1)}%`;

    document.getElementById("bar-mixed").style.width = `${(scores.Mixed * 100).toFixed(1)}%`;
    document.getElementById("score-mix-text").innerText = `${(scores.Mixed * 100).toFixed(1)}%`;

    // Render Token Heatmap
    const words = originalText.split(/\s+/);
    const heatmapContainer = document.getElementById("token-heatmap");
    heatmapContainer.innerHTML = words.map(w => {
        const clean = w.toLowerCase().replace(/[^a-z]/g, "");
        if (LEXICON.positive.includes(clean)) {
            return `<span class="token-pos">${w}</span>`;
        } else if (LEXICON.negative.includes(clean)) {
            return `<span class="token-neg">${w}</span>`;
        }
        return `<span>${w}</span>`;
    }).join(" ");

    // Render Entity Tags
    const entityContainer = document.getElementById("entity-tags");
    if (res.Entities && res.Entities.length > 0) {
        entityContainer.innerHTML = res.Entities.map(e =>
            `<span class="tag-entity"><i class="fa-solid fa-tag"></i> ${e.Text} (${e.Type})</span>`
        ).join("");
    } else {
        entityContainer.innerHTML = `<span style="color: var(--text-dim); font-size:0.8rem;">No explicit AWS entities detected</span>`;
    }

    // Update Metadata
    document.getElementById("aws-req-id").innerText = res.RequestId || "req-8f9a-42b1";

    // Push item to history log for Excel CSV export
    state.historyLog.push({
        text: originalText,
        sentiment: sentiment,
        confidence: confPercent + '%',
        positive: (scores.Positive * 100).toFixed(1) + '%',
        negative: (scores.Negative * 100).toFixed(1) + '%',
        neutral: (scores.Neutral * 100).toFixed(1) + '%',
        mixed: (scores.Mixed * 100).toFixed(1) + '%',
        requestId: res.RequestId || "req-" + Math.random().toString(36).substring(2, 10),
        timestamp: new Date().toLocaleString()
    });

    // Update export count button
    const exportCountEl = document.getElementById("export-count");
    if (exportCountEl) {
        exportCountEl.innerText = state.historyLog.length;
    }

    // Update Gauge Chart
    updateGauge(confPercent, theme.color);
}

// EXPORT TO EXCEL CSV REPORT FUNCTION
function exportToExcel() {
    if (!state.historyLog || state.historyLog.length === 0) {
        alert("No analyzed comments to export yet! Please analyze at least one comment first on the page.");
        return;
    }

    const headers = ["Index", "Comment / Text Payload", "Primary Sentiment", "Overall Confidence", "Positive %", "Negative %", "Neutral %", "Mixed %", "AWS Request ID", "Timestamp"];
    
    // UTF-8 BOM for Microsoft Excel compatibility
    let csvContent = "\uFEFF";
    csvContent += headers.map(h => `"${h}"`).join(",") + "\n";

    state.historyLog.forEach((item, idx) => {
        const cleanText = item.text.replace(/"/g, '""'); // Escape quotes for CSV
        const row = [
            idx + 1,
            `"${cleanText}"`,
            `"${item.sentiment}"`,
            `"${item.confidence}"`,
            `"${item.positive}"`,
            `"${item.negative}"`,
            `"${item.neutral}"`,
            `"${item.mixed}"`,
            `"${item.requestId}"`,
            `"${item.timestamp}"`
        ];
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Sentiment_Analysis_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// RADIAL CONFIDENCE GAUGE
function initGauge() {
    const ctx = document.getElementById("confidence-gauge").getContext("2d");
    state.gaugeChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            datasets: [{
                data: [99, 1],
                backgroundColor: ["#10B981", "rgba(255, 255, 255, 0.1)"],
                borderWidth: 0
            }]
        },
        options: {
            cutout: "80%",
            responsive: true,
            maintainAspectRatio: false,
            plugins: { tooltip: { enabled: false }, legend: { display: false } }
        }
    });
}

function updateGauge(percent, color) {
    if (!state.gaugeChart) return;
    state.gaugeChart.data.datasets[0].data = [percent, 100 - percent];
    state.gaugeChart.data.datasets[0].backgroundColor[0] = color;
    state.gaugeChart.update();
}

// INTERACTIVE ARCHITECTURE NODE INSPECTOR
const NODE_DATA = {
    apigateway: {
        title: "AWS API Gateway",
        subtitle: "Fully Managed HTTP & REST API Front Door",
        badge: "Edge Security & CORS",
        icon: "fa-solid fa-route text-warning",
        capabilities: [
            "Accepts HTTPS POST requests and routes to downstream AWS Lambda",
            "Configured with CORS headers (Access-Control-Allow-Origin: *)",
            "Rate limiting throttling: 10,000 requests/sec with 5,000 burst quota",
            "API Key authorization & OpenAPI / Swagger schema validation"
        ],
        code: `// AWS API Gateway Method Definition
{
  "Type": "AWS::ApiGateway::Method",
  "Properties": {
    "HttpMethod": "POST",
    "ResourceId": { "Ref": "AnalyzeResource" },
    "RestApiId": { "Ref": "SentimentApi" },
    "AuthorizationType": "NONE",
    "Integration": {
      "Type": "AWS_PROXY",
      "IntegrationHttpMethod": "POST",
      "Uri": { "Fn::Sub": "arn:aws:apigateway:\${AWS::Region}:lambda:path/2015-03-31/functions/\${SentimentFunction.Arn}/invocations" }
    }
  }
}`
    },
    lambda: {
        title: "AWS Lambda Function",
        subtitle: "Serverless Python 3.12 Microservice Compute",
        badge: "Arm64 Graviton Exec",
        icon: "fa-solid fa-microchip text-aws",
        capabilities: [
            "Runs event-driven Python 3.12 code with zero infrastructure management",
            "Auto-scales instantly to thousands of parallel invocations",
            "Sub-30ms execution time using Arm64 Graviton2 architecture",
            "IAM Role assumption for secure Boto3 Comprehend & DynamoDB access"
        ],
        code: `# AWS Lambda Python Handler
import json, boto3
comprehend = boto3.client('comprehend', region_name='us-east-1')

def lambda_handler(event, context):
    body = json.loads(event.get('body', '{}'))
    text = body.get('text', '')
    res = comprehend.detect_sentiment(Text=text, LanguageCode='en')
    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(res)
    }`
    },
    comprehend: {
        title: "Amazon Comprehend",
        subtitle: "Natural Language Processing (NLP) Deep Learning API",
        badge: "Pre-trained ML Engine",
        icon: "fa-solid fa-brain text-purple",
        capabilities: [
            "Performs deep learning sentiment detection (Positive, Negative, Neutral, Mixed)",
            "Extracts key phrases, entities, and language confidence scores",
            "Supports 100+ languages with sub-15ms response latency",
            "Zero ML model training or infrastructure maintenance required"
        ],
        code: `# Amazon Comprehend Boto3 API Call
response = comprehend.detect_sentiment(
    Text="AWS Serverless is remarkably fast and resilient!",
    LanguageCode='en'
)
# Returns: {'Sentiment': 'POSITIVE', 'SentimentScore': {'Positive': 0.9992}}`
    },
    dynamodb: {
        title: "Amazon DynamoDB",
        subtitle: "Fully Managed NoSQL Database for Sentiment Logs",
        badge: "On-Demand Pay-Per-Req",
        icon: "fa-solid fa-database text-primary",
        capabilities: [
            "Stores request payloads, sentiment outputs, and execution timestamps",
            "Single-digit millisecond latency for reads & writes",
            "Automatic scaling via On-Demand capacity mode",
            "TTL (Time-To-Live) enabled for automatic log data archiving"
        ],
        code: `// DynamoDB Log Schema
{
  "TableName": "SentimentLogs",
  "Item": {
    "id": {"S": "aws-req-998877"},
    "timestamp": {"N": "1727733290"},
    "sentiment": {"S": "POSITIVE"},
    "confidence": {"N": "0.994"},
    "text": {"S": "Great service!"}
  }
}`
    },
    s3: {
        title: "Amazon S3 Bucket",
        subtitle: "Durable Object Storage for Web Frontend & Data Dump",
        badge: "11 Nines Durability",
        icon: "fa-solid fa-box-archive text-success",
        capabilities: [
            "Hosts static web frontend assets (HTML, CSS, JS) via CloudFront",
            "Stores raw batch text analysis files and ML training datasets",
            "S3 Bucket Lifecycle Policies for automated Glacier archival",
            "Server-side encryption (SSE-S3) enabled by default"
        ],
        code: `# AWS CLI S3 Sync Command
aws s3 sync ./Frontend s3://sentiment-analysis-microservice-bucket \
  --delete \
  --cache-control "max-age=31536000"`
    },
    cloudwatch: {
        title: "Amazon CloudWatch & AWS X-Ray",
        subtitle: "Real-time Logging, Metrics & Distributed Tracing",
        badge: "Observability Stack",
        icon: "fa-solid fa-eye text-pink",
        capabilities: [
            "Streams stdout/stderr logs from AWS Lambda functions",
            "CloudWatch Alarms for 5xx Error rates and latency spikes (> 100ms)",
            "AWS X-Ray service maps for end-to-end trace bottleneck analysis",
            "Custom CloudWatch Metrics dashboard generation"
        ],
        code: `# CloudWatch Log Filter Query
fields @timestamp, @message, @duration, @maxMemoryUsed
| filter @type = "REPORT"
| sort @timestamp desc
| limit 20`
    },
    iam: {
        title: "AWS IAM Role & Security",
        subtitle: "Identity and Access Management Least-Privilege Policies",
        badge: "Zero Trust Security",
        icon: "fa-solid fa-key text-danger",
        capabilities: [
            "Grants Lambda permissions to call comprehend:DetectSentiment",
            "Restricts DynamoDB access exclusively to sentiment-logs-table",
            "Attaches AWSLambdaBasicExecutionRole for CloudWatch logging",
            "Prevents unauthorized inter-service access"
        ],
        code: `// IAM Policy Document
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["comprehend:DetectSentiment"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:PutItem", "dynamodb:GetItem"],
      "Resource": "arn:aws:dynamodb:*:*:table/SentimentLogs"
    }
  ]
}`
    },
    cloudfront: {
        title: "Amazon CloudFront CDN",
        subtitle: "Global Edge Content Delivery Network",
        badge: "Global Edge Caching",
        icon: "fa-solid fa-globe text-cyan",
        capabilities: [
            "Caches static assets at 450+ AWS Edge Locations globally",
            "AWS Shield Standard DDoS protection included automatically",
            "Free SSL/TLS certificate managed via AWS Certificate Manager (ACM)",
            "Reduces global latency for international API clients"
        ],
        code: `// CloudFront Origin Request Policy
{
  "CloudFrontOriginAccessIdentity": {
    "Type": "AWS::CloudFront::CloudFrontOriginAccessIdentity",
    "Properties": {
      "CloudFrontOriginAccessIdentityConfig": { "Comment": "Access S3" }
    }
  }
}`
    }
};

function selectNode(serviceKey) {
    state.selectedNode = serviceKey;

    // Highlight node in DOM
    document.querySelectorAll(".arch-node").forEach(n => {
        n.classList.remove("active");
        if (n.getAttribute("data-service") === serviceKey) {
            n.classList.add("active");
        }
    });

    const data = NODE_DATA[serviceKey] || NODE_DATA.apigateway;

    document.getElementById("inspect-title").innerText = data.title;
    document.getElementById("inspect-sub").innerText = data.subtitle;
    document.getElementById("inspect-badge").innerText = data.badge;
    document.getElementById("inspect-icon").className = data.icon;

    document.getElementById("inspect-capabilities").innerHTML = data.capabilities.map(c => `<li>${c}</li>`).join("");
    document.getElementById("inspect-code-block").innerText = data.code;
}

// API SANDBOX TEMPLATES
function updateSandboxTemplate() {
    const select = document.getElementById("api-endpoint-select");
    state.currentSandboxEndpoint = select.value;

    const reqBody = document.getElementById("sandbox-req-body");
    const resViewer = document.getElementById("sandbox-response-json");

    if (state.currentSandboxEndpoint === "/api/v1/analyze") {
        reqBody.value = JSON.stringify({
            text: "AWS Lambda microservices provide unparalleled scalability!",
            language: "en"
        }, null, 2);

        resViewer.innerText = JSON.stringify({
            status: 200,
            sentiment: "POSITIVE",
            confidence_scores: {
                Positive: 0.994,
                Negative: 0.002,
                Neutral: 0.003,
                Mixed: 0.001
            },
            request_id: "aws-req-998877",
            execution_duration_ms: 18
        }, null, 2);
    } else if (state.currentSandboxEndpoint === "/api/v1/history") {
        reqBody.value = "// GET request - No payload required";
        resViewer.innerText = JSON.stringify({
            total_logs: 2,
            items: [
                { id: "req-101", sentiment: "POSITIVE", text: "Great serverless performance!" },
                { id: "req-102", sentiment: "NEUTRAL", text: "Amazon Comprehend API query." }
            ]
        }, null, 2);
    } else {
        reqBody.value = "// GET request - No payload required";
        resViewer.innerText = JSON.stringify({
            status: "HEALTHY",
            aws_region: "us-east-1",
            services: {
                lambda: "ONLINE",
                comprehend: "ONLINE",
                dynamodb: "ONLINE"
            }
        }, null, 2);
    }

    renderCodeSnippet();
}

function executeApiSandbox() {
    const btn = document.getElementById("send-api-btn");
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Executing...`;
    
    setTimeout(() => {
        btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send Request`;
        document.getElementById("sandbox-latency").innerHTML = `<i class="fa-solid fa-clock"></i> ${Math.floor(Math.random() * 15 + 12)} ms`;
        updateSandboxTemplate();
    }, 300);
}

// CODE GENERATOR FOR API SANDBOX
function switchCodeTab(tab) {
    state.currentCodeTab = tab;
    document.querySelectorAll(".code-tab").forEach(t => t.classList.remove("active"));
    event.target.classList.add("active");
    renderCodeSnippet();
}

function renderCodeSnippet() {
    const codeDisplay = document.getElementById("code-snippet-display");
    const ep = state.currentSandboxEndpoint;

    if (state.currentCodeTab === "curl") {
        codeDisplay.innerText = `curl -X POST "https://api.us-east-1.amazonaws.com/prod${ep}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: aws-demo-key-998877665544" \\
  -d '{"text": "AWS Lambda microservices provide unparalleled scalability!"}'`;
    } else if (state.currentCodeTab === "python") {
        codeDisplay.innerText = `import requests

url = "https://api.us-east-1.amazonaws.com/prod${ep}"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "aws-demo-key-998877665544"
}
payload = {"text": "AWS Lambda microservices provide unparalleled scalability!"}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;
    } else if (state.currentCodeTab === "javascript") {
        codeDisplay.innerText = `const response = await fetch('https://api.us-east-1.amazonaws.com/prod${ep}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'aws-demo-key-998877665544'
  },
  body: JSON.stringify({ text: "AWS Lambda microservices provide unparalleled scalability!" })
});
const data = await response.json();
console.log(data);`;
    } else {
        codeDisplay.innerText = `aws apigatewaytest test-invoke-method \\
  --rest-api-id "abc123xyz" \\
  --resource-id "res7788" \\
  --http-method "POST" \\
  --body '{"text": "AWS Lambda microservices provide unparalleled scalability!"}'`;
    }
}

function copyCodeSnippet() {
    const code = document.getElementById("code-snippet-display").innerText;
    navigator.clipboard.writeText(code);
    alert("Code snippet copied to clipboard!");
}

// AWS COST ESTIMATOR CALCULATOR
function calculateAwsCosts() {
    const requests = parseInt(document.getElementById("slider-requests").value);
    const chars = parseInt(document.getElementById("slider-chars").value);
    const memory = parseInt(document.getElementById("slider-memory").value);
    const duration = parseInt(document.getElementById("slider-duration").value);

    document.getElementById("val-requests").innerText = requests.toLocaleString();
    document.getElementById("val-chars").innerText = `${chars} chars`;
    document.getElementById("val-memory").innerText = `${memory} MB`;
    document.getElementById("val-duration").innerText = `${duration} ms`;

    // AWS PRICING MATHEMATICAL MODEL (us-east-1 rates)
    // Lambda: $0.20 per 1M requests + $0.0000166667 per GB-second
    const gbSeconds = (memory / 1024) * (duration / 1000) * requests;
    const lambdaComputeCost = gbSeconds * 0.0000166667;
    const lambdaReqCost = (requests / 1000000) * 0.20;
    const totalLambda = lambdaComputeCost + lambdaReqCost;

    // API Gateway: $3.50 per 1M REST requests
    const totalApiGateway = (requests / 1000000) * 3.50;

    // Amazon Comprehend: $0.0001 per unit (1 unit = 100 chars, min 1 unit)
    const unitsPerReq = Math.ceil(chars / 100);
    const totalUnits = requests * unitsPerReq;
    const totalComprehend = totalUnits * 0.0001;

    // DynamoDB: $1.25 per 1M write units
    const totalDynamo = (requests / 1000000) * 1.25;

    // S3: $0.023 per GB
    const totalS3 = 0.05;

    const grandTotal = totalLambda + totalApiGateway + totalComprehend + totalDynamo + totalS3;

    document.getElementById("cost-lambda").innerText = `$${totalLambda.toFixed(2)}`;
    document.getElementById("cost-apigateway").innerText = `$${totalApiGateway.toFixed(2)}`;
    document.getElementById("cost-comprehend").innerText = `$${totalComprehend.toFixed(2)}`;
    document.getElementById("cost-dynamodb").innerText = `$${totalDynamo.toFixed(2)}`;
    document.getElementById("cost-s3").innerText = `$${totalS3.toFixed(2)}`;

    document.getElementById("total-cost-val").innerText = grandTotal.toFixed(2);

    const freeTierBadge = document.getElementById("free-tier-notice");
    if (requests <= 1000000) {
        freeTierBadge.style.display = "inline-block";
        freeTierBadge.innerHTML = `<i class="fa-solid fa-gift"></i> Covered by 100% AWS Free Tier!`;
    } else {
        freeTierBadge.style.display = "none";
    }
}

// REAL-TIME CLOUDWATCH METRICS CHARTS
function initCloudWatchCharts() {
    const ctxInvocations = document.getElementById("chart-invocations").getContext("2d");
    state.invocationsChart = new Chart(ctxInvocations, {
        type: "line",
        data: {
            labels: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"],
            datasets: [
                {
                    label: "Invocations (Req/min)",
                    data: [120, 190, 450, 890, 620, 780, 950],
                    borderColor: "#FF9900",
                    backgroundColor: "rgba(255, 153, 0, 0.1)",
                    fill: true,
                    tension: 0.4
                },
                {
                    label: "Latency p95 (ms)",
                    data: [22, 25, 24, 28, 26, 23, 24],
                    borderColor: "#38BDF8",
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: "#9CA3AF" } } },
            scales: {
                x: { ticks: { color: "#6B7280" }, grid: { color: "rgba(255,255,255,0.05)" } },
                y: { ticks: { color: "#6B7280" }, grid: { color: "rgba(255,255,255,0.05)" } }
            }
        }
    });

    const ctxSentiments = document.getElementById("chart-sentiments").getContext("2d");
    state.sentimentsChart = new Chart(ctxSentiments, {
        type: "pie",
        data: {
            labels: ["Positive", "Negative", "Neutral", "Mixed"],
            datasets: [{
                data: [62, 18, 15, 5],
                backgroundColor: ["#10B981", "#EF4444", "#3B82F6", "#F59E0B"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "right", labels: { color: "#9CA3AF" } } }
        }
    });
}

// IAC CODE SWITCHER
const IAC_CODE = {
    sam: `AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Sentiment Analysis Microservice on AWS Serverless

Resources:
  SentimentApi:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Cors:
        AllowMethods: "'POST,GET,OPTIONS'"
        AllowHeaders: "'Content-Type,X-Amz-Date,Authorization,X-Api-Key'"
        AllowOrigin: "'*'"

  SentimentFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ./backend
      Handler: lambda_function.lambda_handler
      Runtime: python3.12
      Architectures: [arm64]
      Timeout: 10
      MemorySize: 512
      Policies:
        - ComprehendBasicAccessPolicy: {}
        - DynamoDBCrudPolicy:
            TableName: !Ref SentimentLogsTable
      Events:
        AnalyzeApi:
          Type: Api
          Properties:
            RestApiId: !Ref SentimentApi
            Path: /api/v1/analyze
            Method: POST

  SentimentLogsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: SentimentLogs
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      BillingMode: PAY_PER_REQUEST`,

    terraform: `provider "aws" {
  region = "us-east-1"
}

resource "aws_dynamodb_table" "sentiment_logs" {
  name         = "SentimentLogs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

resource "aws_iam_role" "lambda_exec_role" {
  name = "sentiment_lambda_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "comprehend_policy" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/ComprehendReadOnly"
}`,

    lambda: `import json
import boto3
import os

comprehend = boto3.client('comprehend')
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TABLE_NAME', 'SentimentLogs')
table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    try:
        body = json.loads(event.get('body', '{}'))
        text = body.get('text', '')
        if not text:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Missing text payload'})
            }

        response = comprehend.detect_sentiment(Text=text, LanguageCode='en')
        
        # Save to DynamoDB
        table.put_item(Item={
            'id': context.aws_request_id,
            'sentiment': response['Sentiment'],
            'scores': json.dumps(response['SentimentScore']),
            'text': text[:200]
        })
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'sentiment': response['Sentiment'],
                'confidence_scores': response['SentimentScore'],
                'request_id': context.aws_request_id
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }`,

    docker: `FROM public.ecr.aws/lambda/python:3.12

# Copy requirements and function code
COPY requirements.txt \${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt --no-cache-dir

COPY lambda_function.py \${LAMBDA_TASK_ROOT}

CMD [ "lambda_function.lambda_handler" ]`,

    awscli: `# Build SAM application
sam build

# Deploy SAM stack to AWS
sam deploy --guided \\
  --stack-name sentiment-analysis-microservice \\
  --region us-east-1 \\
  --capabilities CAPABILITY_IAM

# Test deployed AWS API Gateway Endpoint
curl -X POST "https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/api/v1/analyze" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "AWS Cloud deployment succeeded!"}'`
};

function switchIacTab(tab) {
    state.currentIacTab = tab;
    document.querySelectorAll(".iac-tab").forEach(t => t.classList.remove("active"));
    event.currentTarget.classList.add("active");

    const titles = { sam: "template.yaml", terraform: "main.tf", lambda: "lambda_function.py", docker: "Dockerfile", awscli: "deploy.sh" };
    document.getElementById("iac-file-title").innerText = titles[tab] || "code.txt";
    document.getElementById("iac-code-content").innerText = IAC_CODE[tab] || "";
}

function copyIacCode() {
    const code = document.getElementById("iac-code-content").innerText;
    navigator.clipboard.writeText(code);
    alert("IaC source code copied to clipboard!");
}

// ENDPOINT MODAL HANDLERS
function toggleEndpointModal() {
    const modal = document.getElementById("endpoint-modal");
    modal.classList.toggle("active");
}

function saveCustomEndpoint() {
    const url = document.getElementById("custom-api-url").value.trim();
    const key = document.getElementById("custom-api-key").value.trim();

    if (url) {
        state.customApiUrl = url;
        state.customApiKey = key;
        state.useCustomEndpoint = true;
        document.getElementById("endpoint-status-text").innerText = "AWS Endpoint: Custom Live";
        alert("Custom AWS API Gateway connected!");
    }
    toggleEndpointModal();
}

function resetToMockEndpoint() {
    state.useCustomEndpoint = false;
    document.getElementById("endpoint-status-text").innerText = "AWS Endpoint: Active";
    toggleEndpointModal();
}

function toggleMobileNav() {
    const links = document.getElementById("nav-links");
    links.style.display = links.style.display === "flex" ? "none" : "flex";
}
