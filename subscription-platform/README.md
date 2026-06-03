# Subscription Platform

> A Spotify-like tier-based subscription service built on AWS — academic demo project.

## Tech Stack

| Layer      | Technology                                                        |
|------------|-------------------------------------------------------------------|
| Frontend   | React (Vite), React Router DOM                                    |
| Backend    | Node.js 20.x, Express.js, AWS Lambda                              |
| Database   | Amazon DynamoDB                                                   |
| Storage    | Amazon S3 (pre-signed URLs)                                       |
| Auth       | JWT (jsonwebtoken + bcryptjs)                                     |
| Messaging  | Amazon SNS → Lambda → Amazon SES                                  |
| Workflow   | AWS Step Functions (5-second subscription expiry)                  |
| API        | Amazon API Gateway (HTTP API)                                     |
| Monitoring | Amazon CloudWatch                                                 |
| Region     | ap-southeast-1 (Singapore)                                        |

---

## Architecture

```
React Frontend (Vite)
       │
       ▼
  API Gateway (HTTP API)
       │
       ├────────────────────────────┐
       │                            │
       ▼                            ▼
  appLambda                   paymentLambda
  (Express.js)                (Payment Sim)
       │                            │
       │                     Step Functions
       │                     (Wait 5 sec)
       │                            │
       │                     expirationLambda
       │                            │
       ├──────── DynamoDB ──────────┤
       │                            │
       ├──────── S3 (media) ────────┘
       │
  paymentLambda ──┐
  expirationLambda┤
                  ▼
            SNS Topic
                  │
                  ▼
        notificationLambda
                  │
                  ▼
            SES (Email)
```

**Key demo features:**
- Subscription duration = **5 seconds** (not 1 month) for live demo
- Payment success/failure = **70/30 random split** to show both paths
- Emails sent on: payment success, payment failure, subscription expiry

---

## Quick Start

### Prerequisites

- Node.js 20.x
- AWS account with access to: Lambda, DynamoDB, S3, SNS, SES, Step Functions, API Gateway, CloudWatch, IAM
- npm

### Clone & Install

```bash
git clone <repo-url>
cd subscription-platform

# Install each Lambda
cd backend/app-lambda && npm install && cd ../..
cd backend/payment-lambda && npm install && cd ../..
cd backend/expiration-lambda && npm install && cd ../..
cd backend/notification-lambda && npm install && cd ../..

# Install frontend
cd frontend && npm install && npm install react-router-dom && cd ..
```

---

## Environment Variables

### backend/app-lambda/.env

| Variable       | Description                        | Example                            |
|----------------|------------------------------------|------------------------------------|
| JWT_SECRET     | Secret key for signing JWTs        | my-super-secret-key-change-me      |
| AWS_REGION     | AWS region                         | ap-southeast-1                     |
| USERS_TABLE    | DynamoDB Users table name          | Users                              |
| CONTENT_TABLE  | DynamoDB Content table name        | Content                            |
| MEDIA_BUCKET   | S3 bucket for media files          | subscription-platform-media        |

### backend/payment-lambda/.env

| Variable          | Description                        | Example                                                                             |
|-------------------|------------------------------------|-------------------------------------------------------------------------------------|
| AWS_REGION        | AWS region                         | ap-southeast-1                                                                      |
| USERS_TABLE       | DynamoDB Users table name          | Users                                                                               |
| STATE_MACHINE_ARN | Step Functions state machine ARN   | arn:aws:states:ap-southeast-1:123456789012:stateMachine:subscription-expiration-workflow |
| SNS_TOPIC_ARN     | SNS topic ARN                      | arn:aws:sns:ap-southeast-1:123456789012:subscription-notifications                   |

### backend/expiration-lambda/.env

| Variable       | Description            | Example                                                                  |
|----------------|------------------------|--------------------------------------------------------------------------|
| AWS_REGION     | AWS region             | ap-southeast-1                                                           |
| USERS_TABLE    | DynamoDB Users table   | Users                                                                    |
| SNS_TOPIC_ARN  | SNS topic ARN          | arn:aws:sns:ap-southeast-1:123456789012:subscription-notifications        |

### backend/notification-lambda/.env

| Variable      | Description              | Example              |
|---------------|--------------------------|----------------------|
| SENDER_EMAIL  | Verified SES sender email| noreply@example.com  |

### frontend/.env

| Variable      | Description               | Example                                                     |
|---------------|---------------------------|-------------------------------------------------------------|
| VITE_API_URL  | API Gateway invoke URL    | https://abc123xyz.execute-api.ap-southeast-1.amazonaws.com  |

---

## API Endpoints

| Method | Path              | Auth Required | Lambda         | Description                        |
|--------|-------------------|---------------|----------------|------------------------------------|
| GET    | /                 | No            | appLambda      | Health check                       |
| POST   | /auth/register    | No            | appLambda      | Register new user                  |
| POST   | /auth/login       | No            | appLambda      | Login, returns JWT                 |
| GET    | /user/status      | Yes (Bearer)  | appLambda      | Get user tier & subscription status|
| GET    | /content          | Yes (Bearer)  | appLambda      | List all content (safe fields)     |
| GET    | /content/:id      | Yes (Bearer)  | appLambda      | Access content (tier check + URL)  |
| POST   | /subscribe        | No*           | paymentLambda  | Simulate payment & subscribe       |

*`/subscribe` receives userId, email, tier in the request body.

---

## AWS Setup Checklist

Complete these in order. See **TEAM_GUIDE.txt** for detailed step-by-step instructions.

- [ ] Create IAM roles for all 4 Lambdas
- [ ] Create DynamoDB `Users` table (PK: `userId`)
- [ ] Add GSI `email-index` on `Users` table (PK: `email`)
- [ ] Create DynamoDB `Content` table (PK: `contentId`)
- [ ] Insert 8 sample content items into `Content` table
- [ ] Create S3 bucket `subscription-platform-media` (Block Public Access ON)
- [ ] Create S3 folders: `free/`, `basic/`, `standard/`, `premium/`, `thumbnail/`
- [ ] Upload placeholder media files to S3
- [ ] Create SNS topic `subscription-notifications` (Standard)
- [ ] Verify all demo email addresses in SES
- [ ] Create all 4 Lambda functions (Node.js 20.x)
- [ ] Deploy Lambda ZIPs
- [ ] Set environment variables on each Lambda
- [ ] Create Step Functions state machine from `infra/stepfunctions/subscription-expiration-workflow.json`
- [ ] Subscribe `notificationLambda` to SNS topic
- [ ] Create API Gateway HTTP API with routes
- [ ] Configure CORS on API Gateway
- [ ] Create CloudWatch dashboard `SubscriptionPlatform`

---

## Deployment Commands

```bash
# appLambda
cd backend/app-lambda
npm install
zip -r appLambda.zip .
# Upload ZIP → Lambda Console → appLambda
# Handler: src/lambda.handler | Memory: 512 MB | Timeout: 15s

# paymentLambda
cd backend/payment-lambda
npm install
zip -r paymentLambda.zip .
# Handler: index.handler | Memory: 256 MB | Timeout: 10s

# expirationLambda
cd backend/expiration-lambda
npm install
zip -r expirationLambda.zip .
# Handler: index.handler | Memory: 256 MB | Timeout: 15s

# notificationLambda
cd backend/notification-lambda
npm install
zip -r notificationLambda.zip .
# Handler: index.handler | Memory: 256 MB | Timeout: 15s
```

---

## Frontend Deployment

```bash
cd frontend
npm install
npm install react-router-dom
cp .env.example .env
# Edit .env → set VITE_API_URL to your API Gateway URL
npm run dev          # local development
npm run build        # production build → deploy dist/ to Vercel or S3
```

---

## Demo Flow Summary

1. Show architecture diagram
2. Register a new user
3. Log in → receive JWT
4. Browse content list (tier labels shown)
5. Try accessing premium content → blocked ("Subscription inactive")
6. Subscribe with "Premium" tier
7. On success → show email, DynamoDB status, access premium content
8. Watch 5-second countdown → subscription expires
9. Show expiry email, DynamoDB status update
10. Try premium content again → blocked
11. Show CloudWatch logs
12. (If payment failed → show failure email, retry)

Full demo script with exact steps is in **TEAM_GUIDE.txt**, Section 17.

---

## License

MIT
