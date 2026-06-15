================================================================================
                        TEAM GUIDE — SUBSCRIPTION PLATFORM
                        Complete Study & Reference Document
================================================================================

Read this entire document before writing or touching any code. It is written
so that any team member — even one with zero AWS experience — can understand
what this project does, why every technical decision was made, and how to get
everything running for the demo.

This is your primary study resource. Keep it open alongside your code.

================================================================================
SECTION 1 — WHAT THIS PROJECT IS
================================================================================

This project is a demo subscription platform, conceptually similar to Spotify
or Netflix. Users can:

  1. Register an account (email + password)
  2. Log in and receive a token
  3. Browse a library of content (videos, in theory)
  4. Choose a subscription tier (Basic, Standard, or Premium)
  5. "Pay" for the subscription (simulated)
  6. Access tier-locked content while their subscription is active
  7. Lose access when the subscription expires

It is built entirely on Amazon Web Services (AWS) and exists purely as an
academic project to be presented to a lecturer. Because of that, two things
are intentionally different from a real-world subscription service:

  SIMULATION 1 — SUBSCRIPTION DURATION IS 5 SECONDS

    A real subscription lasts a month. Ours lasts 5 seconds. Why? Because
    during the live demo, we need to show the FULL lifecycle in real time:
    subscribe -> access content -> subscription expires -> access denied.
    If we used a 30-day duration, we could never demonstrate the expiry
    in front of the lecturer. Five seconds lets us show everything in one
    smooth demo flow.

  SIMULATION 2 — PAYMENT SUCCESS IS 70/30 RANDOM

    A real payment gateway (Stripe, PayPal) actually charges a credit card.
    Ours uses Math.random() — 70% of payment attempts succeed, 30% fail.
    Why? Because we need to demonstrate BOTH the success email AND the
    failure email during the presentation. If payments always succeeded,
    we could never show the failure path. The 70/30 split means that in a
    few tries we will see both outcomes.

These two simulations are the heart of the demo. Understand them well —
the lecturer will likely ask about them.

================================================================================
SECTION 2 — HOW THE WHOLE SYSTEM FLOWS — END TO END
================================================================================

Here is a complete step-by-step narrative of every possible user journey.
For each step, the AWS service or Lambda involved is named explicitly.

--- FLOW A: USER REGISTERS ---

  1. User opens the React frontend in their browser.
  2. User navigates to the Register page.
  3. User types an email and password and clicks "Register".
  4. The frontend sends a POST request to /auth/register.
  5. The request hits API Gateway (HTTP API).
  6. API Gateway routes ANY /{proxy+} to appLambda.
  7. appLambda (Express.js) receives the request on the /auth/register route.
  8. The auth route handler:
     a) Checks that email and password are provided (400 if not).
     b) Calls getUserByEmail() in userService.js.
        This runs a QueryCommand on DynamoDB's Users table using the
        GSI "email-index" to look up the email.
     c) If a user with that email already exists -> return 409 Conflict.
     d) Hashes the password using bcryptjs with 10 salt rounds.
        This means the plain-text password is NEVER stored. Only the
        hash goes into the database.
     e) Creates a new user object:
        - userId: a random UUID (universally unique identifier)
        - email: what the user typed
        - passwordHash: the bcrypt hash
        - tier: "free" (everyone starts at free)
        - subStatus: "none" (no subscription yet)
        - subStart: null
        - subExpire: null
        - createdAt: current timestamp in ISO format
     f) Calls createUser() which runs a PutCommand on DynamoDB's Users table.
  9. Returns 201 Created with { success: true, userId: "the-uuid" }.
  10. The frontend shows a success message.

--- FLOW B: USER LOGS IN ---

  1. User navigates to the Login page.
  2. User types email and password and clicks "Login".
  3. Frontend sends POST /auth/login to API Gateway -> appLambda.
  4. The auth route handler:
     a) Calls getUserByEmail() to find the user in DynamoDB.
        Again, this uses the GSI "email-index", NOT a full table scan.
     b) If no user found -> return 401 Unauthorized.
     c) Compares the typed password against the stored hash using
        bcrypt.compare(). If it does not match -> return 401.
     d) If it matches, creates a JWT (JSON Web Token):
        jwt.sign({ userId, email, tier }, JWT_SECRET, { expiresIn: "24h" })
        This token is a cryptographically signed string that carries
        the user's identity (userId, email, tier) inside it.
     e) Returns 200 with:
        { success: true, token: "eyJhbG...", user: { userId, email, tier, subStatus } }
  5. The frontend stores the token in localStorage.
  6. The frontend stores the user object in localStorage.
  7. The frontend redirects to the Content page.

  From this point on, every API call from the frontend includes the token
  in the Authorization header: "Bearer eyJhbG..."

--- FLOW C: USER BROWSES CONTENT ---

  1. User is on the Content page.
  2. On page load, the frontend calls GET /content with the Bearer token.
  3. API Gateway -> appLambda -> content route handler:
     a) The verifyToken middleware runs first:
        - Reads the Authorization header.
        - Extracts the token after "Bearer ".
        - Calls jwt.verify(token, JWT_SECRET).
        - If valid, puts the decoded payload { userId, email, tier }
          onto req.user so all subsequent code can use it.
        - If invalid or missing, returns 401 immediately.
     b) Calls getAllContent() which runs a ScanCommand on the Content table.
        (Scan is OK here because Content is a small, fixed table — 8 items.)
     c) Maps the results to SAFE fields only:
        contentId, title, description, requiredTier, type
        The s3Key and thumbnailKey are deliberately EXCLUDED from this
        response. If we exposed s3Key, a clever user could construct
        their own S3 URL and bypass the tier check. Security through
        not leaking internal storage paths.
  4. Frontend displays a list of content items with their tier labels.

--- FLOW D: USER TRIES TO ACCESS PREMIUM CONTENT WITHOUT SUBSCRIBING ---

  1. User clicks on a premium content item (e.g., VID007).
  2. Frontend calls GET /content/VID007 with Bearer token.
  3. appLambda content route handler:
     a) verifyToken middleware runs -> req.user is set.
     b) Calls getContentById("VID007") from DynamoDB -> finds the content.
     c) Calls getUserById(req.user.userId) from DynamoDB to get the
        user's CURRENT subscription status.
        IMPORTANT: We read from DynamoDB here, not from the JWT, because
        the JWT's tier field might be stale (e.g., the subscription just
        expired 2 seconds ago but the JWT was issued 10 minutes ago).
     d) Checks: user.subStatus !== "active" -> true (subStatus is "none").
     e) Returns 403 { error: "Subscription inactive" }.
  4. Frontend shows the error to the user.

--- FLOW E: USER SUBSCRIBES (SUCCESS PATH — 70% CHANCE) ---

  1. User navigates to the Subscription page.
  2. User selects "Premium" from the dropdown.
  3. User clicks "Subscribe Premium".
  4. Frontend sends POST /subscribe with body:
     { userId: "uuid", email: "user@email.com", tier: "premium" }
  5. API Gateway routes POST /subscribe to paymentLambda (separate Lambda).
  6. paymentLambda handler:
     a) Parses the body to get userId, email, tier.
     b) Runs the payment simulation: Math.random() < 0.7
        Let's say the result is true (success — 70% chance).
     c) SUCCESS PATH — three things happen:

        THING 1: Update DynamoDB
          Runs an UpdateCommand on the Users table:
          SET tier = "premium", subStatus = "active", subStart = now
          Note: "tier" is a reserved word in DynamoDB, so the code uses
          ExpressionAttributeNames to alias it as #tier. If you forget
          this, you get a cryptic 400 error.

        THING 2: Start Step Functions execution
          Calls StartExecutionCommand with:
          - stateMachineArn: the ARN of our state machine
          - name: "sub-{userId}-{timestamp}" (must be unique per execution)
          - input: JSON string { userId, email, tier }
          This kicks off the 5-second countdown. Step Functions will
          wait 5 seconds and then invoke expirationLambda.

        THING 3: Publish PAYMENT_SUCCESS to SNS
          Calls PublishCommand with:
          - TopicArn: our SNS topic ARN
          - Message: { type: "PAYMENT_SUCCESS", email, userId }
          This triggers notificationLambda to send a success email.

     d) Returns { statusCode: 200, body: { success: true } }.
  7. Frontend receives { success: true }.
  8. Frontend starts a countdown from 5 to 0 (visual timer on screen).

--- FLOW F: USER GETS A SUCCESS EMAIL ---

  1. When paymentLambda published PAYMENT_SUCCESS to SNS...
  2. SNS delivers the message to its subscriber: notificationLambda.
  3. notificationLambda handler:
     a) Reads the SNS message from event.Records[0].Sns.Message.
     b) Parses the JSON -> { type: "PAYMENT_SUCCESS", email, userId }.
     c) Switch on payload.type -> calls paymentSuccess(email) template.
     d) paymentSuccess() returns:
        subject: "Subscription Activated"
        body: A friendly email saying the subscription is now active.
     e) Sends the email via SES (SendEmailCommand):
        From: process.env.SENDER_EMAIL (must be verified in SES)
        To: the user's email (must also be verified in SES sandbox mode)
  4. User receives the "Subscription Activated" email in their inbox.

--- FLOW G: USER ACCESSES PREMIUM CONTENT ---

  1. User goes back to the Content page and clicks on VID007 again.
  2. Frontend calls GET /content/VID007 with Bearer token.
  3. appLambda content route handler:
     a) verifyToken -> req.user is set.
     b) getContentById("VID007") -> finds it, requiredTier = "premium".
     c) getUserById(req.user.userId) -> user's tier is now "premium",
        subStatus is "active".
     d) Checks: user.subStatus !== "active" -> false (it IS active). PASS.
     e) Checks: tierRank("premium") >= tierRank("premium") -> 3 >= 3. PASS.
     f) Calls generateSignedUrl(content.s3Key) which creates a pre-signed
        S3 URL valid for 30 seconds.
     g) Returns { contentId: "VID007", title: "...", url: "https://s3...signed..." }.
  4. Frontend can use this URL to display/play the content.

--- FLOW H: 5 SECONDS PASS — SUBSCRIPTION EXPIRES ---

  1. Remember that paymentLambda started a Step Functions execution.
  2. The state machine has two states:
     State 1: WaitSubscription — Type: Wait, Seconds: 5
     State 2: ExpireSubscription — Type: Task, invokes expirationLambda
  3. After 5 seconds, Step Functions automatically invokes expirationLambda.
  4. expirationLambda handler:
     a) Receives event directly from Step Functions (NOT an HTTP event).
        event = { userId, email, tier } — the same input passed to StartExecution.
        There is NO event.body. Do NOT call JSON.parse(event.body).
     b) Updates DynamoDB: SET subStatus = "expired".
     c) Publishes SUBSCRIPTION_EXPIRED to SNS.
  5. DynamoDB now shows subStatus = "expired" for this user.

--- FLOW I: USER GETS AN EXPIRY EMAIL ---

  1. SNS delivers SUBSCRIPTION_EXPIRED to notificationLambda.
  2. notificationLambda reads type = "SUBSCRIPTION_EXPIRED".
  3. Calls subscriptionExpired(email) template.
  4. Sends email via SES: "Your subscription has expired."
  5. User receives the expiry email.

--- FLOW J: USER TRIES TO ACCESS PREMIUM CONTENT AGAIN — BLOCKED ---

  1. User clicks on VID007 again.
  2. appLambda content route:
     a) getUserById -> user's subStatus is now "expired".
     b) Checks: user.subStatus !== "active" -> true. BLOCKED.
     c) Returns 403 { error: "Subscription inactive" }.
  3. User is locked out until they subscribe again.

--- FLOW K: PAYMENT FAILS (30% PATH) ---

  1. User clicks "Subscribe Premium".
  2. paymentLambda: Math.random() < 0.7 returns false (30% chance).
  3. FAILURE PATH — only ONE thing happens:
     Publishes PAYMENT_FAILED to SNS.
     No DynamoDB update. No Step Functions execution.
  4. Returns { success: false } to the frontend.
  5. SNS -> notificationLambda -> paymentFailed(email) template.
  6. User receives a "Payment Failed" email.
  7. Frontend shows the failure. User can try again.

================================================================================
SECTION 3 — AWS SERVICES EXPLAINED FOR BEGINNERS
================================================================================

If you have never used AWS before, read this section carefully. Each service
is explained in plain English with its role in OUR project.

--- API GATEWAY ---

  What it is:
    A managed service that acts as the "front door" for your backend APIs.
    It receives HTTP requests from the internet and routes them to the
    correct backend service (in our case, Lambda functions).

  Role in this project:
    API Gateway receives ALL requests from the React frontend. It has two
    routing rules:
      - ANY /{proxy+} -> appLambda (handles auth, content, user routes)
      - POST /subscribe -> paymentLambda (handles payment simulation)
    The {proxy+} is a catch-all — it forwards /auth/login, /content, etc.
    all to appLambda, which uses Express.js routing internally.

  Gotcha:
    You MUST configure CORS on API Gateway. Without it, the browser will
    block all requests from your frontend (different origin). Go to
    API Gateway -> your API -> CORS and set:
      Allow Origins: *
      Allow Methods: GET, POST, OPTIONS
      Allow Headers: Content-Type, Authorization

--- AWS LAMBDA ---

  What it is:
    A "serverless" compute service. You upload your code as a ZIP file,
    and AWS runs it on demand. You do not manage any servers. Lambda
    charges you only for the time your code actually runs.

  Role in this project:
    We have FOUR Lambda functions:
      1. appLambda — the main Express.js app (auth, content, user routes)
      2. paymentLambda — payment simulation + Step Functions trigger
      3. expirationLambda — marks subscription as expired after 5 seconds
      4. notificationLambda — sends emails via SES when triggered by SNS

  Gotcha:
    Lambda has a timeout setting. If your code takes longer than the timeout,
    Lambda kills it. Our appLambda timeout is 15 seconds. If you get random
    "Task timed out" errors, increase the timeout in Lambda -> Configuration
    -> General Configuration -> Timeout.

--- AMAZON DYNAMODB ---

  What it is:
    A fully managed NoSQL database. Instead of SQL tables with rigid schemas,
    DynamoDB stores items (think JSON objects) in tables. Each table has a
    partition key (like a primary key in SQL) that uniquely identifies items.

  Role in this project:
    Two tables:
      Users — stores user accounts. Partition key: userId.
        Fields: userId, email, passwordHash, tier, subStatus, subStart,
                subExpire, createdAt
      Content — stores content metadata. Partition key: contentId.
        Fields: contentId, title, description, requiredTier, type,
                s3Key, thumbnailKey

  Gotcha:
    "tier" is a reserved word in DynamoDB's expression syntax. When you use
    it in an UpdateExpression, you must use ExpressionAttributeNames to alias
    it (e.g., #tier). If you forget, you get a mysterious 400 error with
    a message about reserved words. This is one of the most common DynamoDB
    mistakes and is already handled in our code.

--- AMAZON S3 ---

  What it is:
    Simple Storage Service — cloud file storage. You create "buckets" and
    upload files into them. Files are organized with key prefixes that look
    like folder paths (e.g., "premium/aws-security.mp4").

  Role in this project:
    Stores the actual media files (videos) that users access. The bucket
    is named subscription-platform-media. Folder structure:
      free/       — content for free tier
      basic/      — content for basic tier
      standard/   — content for standard tier
      premium/    — content for premium tier
      thumbnail/  — thumbnail images

  Gotcha:
    Block Public Access is ENABLED. This means nobody can access files via
    a direct URL. The only way to access files is through pre-signed URLs
    generated by appLambda using the AWS SDK. These URLs expire after 30
    seconds. If your signed URLs are not working, check:
      1. The bucket name in the MEDIA_BUCKET env var matches exactly.
      2. The appLambda IAM role has AmazonS3ReadOnlyAccess.
      3. The s3Key in DynamoDB matches the actual file path in S3.

--- AMAZON SNS ---

  What it is:
    Simple Notification Service — a pub/sub (publish/subscribe) messaging
    service. Publishers send messages to a "topic". Subscribers receive
    those messages automatically. Think of it like a group chat — anyone
    can post, and everyone subscribed gets the message.

  Role in this project:
    We have one SNS topic: subscription-notifications.
    Publishers: paymentLambda and expirationLambda.
    Subscriber: notificationLambda.
    Message format: { type: "PAYMENT_SUCCESS", email, userId }
    The type field tells notificationLambda which email template to use.

  Gotcha:
    After creating the SNS topic, you must ADD notificationLambda as a
    subscriber. Go to SNS -> Topics -> subscription-notifications ->
    Create Subscription -> Protocol: AWS Lambda -> Endpoint: select
    notificationLambda ARN. If you forget this, SNS will publish messages
    but nobody will receive them. Emails will not be sent and there will
    be no error message — it just silently does nothing.

--- AMAZON SES ---

  What it is:
    Simple Email Service — sends emails programmatically. Your code calls
    the SES API with a from address, to address, subject, and body, and
    SES delivers the email.

  Role in this project:
    notificationLambda uses SES to send three types of emails:
      1. "Subscription Activated" (payment success)
      2. "Payment Failed" (payment failure)
      3. "Subscription Expired" (5-second timer elapsed)

  Gotcha (CRITICAL):
    SES starts in SANDBOX MODE. In sandbox, you can ONLY send emails to
    verified email addresses. Both the sender (SENDER_EMAIL env var) and
    every recipient must be verified. If you forget to verify an email,
    SES will reject the send and notificationLambda will throw an error.
    VERIFY ALL EMAILS ON DAY 1. See Section 10 for detailed steps.

--- AWS STEP FUNCTIONS ---

  What it is:
    A workflow orchestration service. You define a "state machine" — a
    series of steps (states) that execute in sequence. States can be
    Tasks (run a Lambda), Wait (pause for a duration), Choice (branch
    based on conditions), and more.

  Role in this project:
    Our state machine has exactly two states:
      1. WaitSubscription — Wait state, pauses for 5 seconds.
      2. ExpireSubscription — Task state, invokes expirationLambda.
    When a user subscribes successfully, paymentLambda starts an execution
    of this state machine. After 5 seconds, the state machine automatically
    invokes expirationLambda, which marks the subscription as expired.

  Gotcha:
    When creating the state machine, you must replace the placeholder
    REPLACE_WITH_EXPIRATION_LAMBDA_ARN in the JSON definition with the
    actual ARN of your expirationLambda. You can find the ARN in the
    Lambda console at the top of the function page.

--- AMAZON CLOUDWATCH ---

  What it is:
    AWS's monitoring and logging service. Every Lambda automatically writes
    logs to CloudWatch. You can also create dashboards to visualize metrics
    like invocation counts, errors, and durations.

  Role in this project:
    All four Lambdas write console.log() output to CloudWatch Logs. We
    create a dashboard called SubscriptionPlatform with widgets showing:
      - Lambda Invocations (per function)
      - Lambda Errors (per function)
      - Lambda Duration (per function)
      - API Gateway request counts
    This dashboard is shown during the presentation to demonstrate
    operational monitoring.

  Gotcha:
    CloudWatch Logs can take 10-30 seconds to appear. If you invoke a
    Lambda and immediately check logs, you might see nothing. Wait a
    moment and refresh. Also, each Lambda must have CloudWatchLogsFullAccess
    in its IAM role — without it, logs silently fail to write.

--- AWS IAM ---

  What it is:
    Identity and Access Management — controls WHO can do WHAT on AWS.
    Every Lambda function runs under an "execution role" that determines
    which AWS services it can access. Without the right permissions,
    Lambda calls to DynamoDB, S3, SNS, SES, or Step Functions will fail
    with "Access Denied" errors.

  Role in this project:
    Each Lambda has its own IAM role with specific policies attached.
    For example, appLambda needs DynamoDB and S3 access, but not SES.
    notificationLambda needs SES access, but not DynamoDB.

  Gotcha:
    If you get "Access Denied" or "is not authorized to perform" errors,
    the FIRST thing to check is the Lambda's IAM role. Go to Lambda ->
    Configuration -> Permissions -> click the role name -> verify the
    policies are attached. See Section 11 for the exact policies each
    Lambda needs.

================================================================================
SECTION 4 — WHY STEP FUNCTIONS AND NOT EVENTBRIDGE FOR THE 5-SECOND TIMER
================================================================================

You might wonder: "AWS has EventBridge for scheduling things. Why not use
EventBridge to schedule the subscription expiration?"

The answer is a hard technical constraint:

  Amazon EventBridge has a MINIMUM scheduling granularity of 1 MINUTE.
  You cannot create an EventBridge rule that fires in 5 seconds. The
  smallest interval EventBridge supports is "every 1 minute" for rate
  expressions, and cron expressions also have minute-level precision.

  AWS Step Functions, on the other hand, supports Wait states with
  SECOND-level precision. You can say "Wait 5 seconds" and it does
  exactly that.

This was a deliberate architectural decision, not a random choice. If
the lecturer asks "Why didn't you use EventBridge?", the answer is:
"EventBridge cannot schedule events less than 1 minute in the future.
Our subscription duration is 5 seconds for demo purposes, so we used
Step Functions' Wait state which supports second-level precision."

Our state machine is simple:

  State 1: WaitSubscription
    Type: Wait
    Seconds: 5
    Next: ExpireSubscription

  State 2: ExpireSubscription
    Type: Task
    Resource: [ARN of expirationLambda]
    End: true

That's it. Two states. Wait, then invoke. Simple and effective.

================================================================================
SECTION 5 — WHY JWT AND NOT SESSION-BASED AUTH
================================================================================

This section explains an important architectural decision. The lecturer will
likely ask about authentication — be ready to explain this clearly.

WHAT IS SESSION-BASED AUTH?
  In traditional session auth, when a user logs in:
    1. The server creates a "session" — a record stored in memory or a database
       (like Redis) saying "session ID abc123 belongs to User #42."
    2. The server sends session ID abc123 to the browser as a cookie.
    3. On every subsequent request, the browser sends the cookie.
    4. The server looks up session ID abc123 in its session store to figure
       out who the user is.

  The problem: this requires a PERSISTENT SESSION STORE. The server must
  remember sessions between requests.

WHY THAT DOES NOT WORK WITH AWS LAMBDA:
  Lambda is STATELESS. Every invocation runs in a fresh execution environment.
  There is no persistent memory between invocations. There is no "server"
  running continuously that can hold sessions in memory.

  If we used session auth with Lambda, we would need:
    - An external session store (Redis via ElastiCache, or DynamoDB)
    - A database lookup on EVERY SINGLE REQUEST just to identify the user

  That is wasteful and adds latency, cost, and complexity.

WHAT IS JWT AUTH?
  JWT (JSON Web Token) is a self-contained token. When the user logs in:
    1. The server creates a JWT containing { userId, email, tier }.
    2. The server SIGNS the JWT with a secret key (JWT_SECRET).
    3. The server sends the JWT to the frontend.
    4. On every request, the frontend sends the JWT in the Authorization header.
    5. The server calls jwt.verify(token, JWT_SECRET) — this verifies the
       cryptographic signature WITHOUT any database lookup.
    6. The server reads userId, email, tier directly from the decoded token.

  No session store needed. No database call for authentication. The token
  itself proves who the user is.

THE IMPORTANT NUANCE — AUTHORIZATION STILL USES DYNAMODB:
  JWT tells us WHO the user is (identity/authentication).
  But can this user access this content? That is AUTHORIZATION.

  For authorization, we ALWAYS read the user's current data from DynamoDB.
  Why? Because the JWT might contain stale data. For example:
    - User logs in -> JWT says tier="free", subStatus="none"
    - User subscribes to premium -> DynamoDB updated to tier="premium",
      subStatus="active"
    - The JWT still says tier="free" because it was issued before subscribing
    - 5 seconds later -> DynamoDB updated to subStatus="expired"

  If we relied only on the JWT for authorization, the user's access level
  would be frozen at whatever it was when they logged in. By reading
  DynamoDB on every content access request, we get the REAL-TIME status.

  SUMMARY:
    - Authentication (who are you?) -> JWT (no DB call)
    - Authorization (can you access this?) -> DynamoDB (always fresh)

  This distinction is important. Be ready to explain it.

================================================================================
SECTION 6 — WHY THE GSI (GLOBAL SECONDARY INDEX) ON THE USERS TABLE
================================================================================

This is a DynamoDB concept that trips up beginners. Read carefully.

THE PROBLEM:
  Our Users table has userId as the partition key (primary key). This means
  DynamoDB can efficiently look up a user BY userId — it is like looking up
  a word in a dictionary that is alphabetized by that word.

  But during LOGIN, we do not have the userId. The user types their EMAIL
  and password. We need to find the user record by email.

  Without a GSI, the only way to find a user by email is a SCAN operation.
  A Scan reads the ENTIRE table, item by item, checking each one's email
  field. This is:
    - Slow: proportional to table size
    - Expensive: you pay per data read
    - Bad practice: it does not scale

  Think of it like looking for a phone number in a phone book that is
  organized by first name, but you only know the person's last name.
  You would have to read every single entry. That is a Scan.

THE SOLUTION — GSI:
  A Global Secondary Index (GSI) is like creating a SECOND copy of the
  table that is organized by a different field. We create a GSI called
  "email-index" with email as the partition key.

  Now we can run a QueryCommand with IndexName: "email-index" and
  KeyConditionExpression: "email = :email". This is a direct lookup —
  fast, cheap, and scalable. Like having a second phone book organized
  by last name.

HOW TO CREATE THE GSI:
  1. Go to AWS Console -> DynamoDB -> Tables -> Users
  2. Click the "Indexes" tab
  3. Click "Create Index"
  4. Partition key: email (String)
  5. Index name: email-index
  6. Leave sort key empty
  7. Leave other settings as default
  8. Click "Create Index"
  9. Wait for the index status to change from "Creating" to "Active"
     (this can take a minute or two)

IMPORTANT: The index name in the code (userService.js) is "email-index".
It must match EXACTLY what you name it in the AWS Console. If they do not
match, the QueryCommand will fail with a validation error and logins will
return 500 errors.

================================================================================
SECTION 7 — THE TIER SYSTEM AND ACCESS CONTROL LOGIC
================================================================================

THE FOUR TIERS:
  free     = rank 0
  basic    = rank 1
  standard = rank 2
  premium  = rank 3

The tierRank utility function converts a tier name to a number:

  function tierRank(tier) {
    const ranks = { free: 0, basic: 1, standard: 2, premium: 3 };
    return ranks[tier] ?? 0;
  }

The ?? 0 means: if the tier is not recognized, treat it as free (rank 0).

CONTENT ACCESS REQUIRES TWO CONDITIONS — BOTH MUST PASS:

  Condition 1: user.subStatus === "active"
    The user's subscription must be currently active. Not "none", not
    "expired" — specifically "active".

  Condition 2: tierRank(user.tier) >= tierRank(content.requiredTier)
    The user's tier rank must be equal to or higher than the content's
    required tier rank. A premium user (rank 3) can access everything.
    A basic user (rank 1) can access basic and free content but not
    standard or premium.

EXAMPLE SCENARIOS:

  Scenario 1: Free user, active subscription, requests free content
    subStatus = "active" -> PASS
    tierRank("free") >= tierRank("free") -> 0 >= 0 -> PASS
    Result: ALLOWED

  Scenario 2: Free user, active subscription, requests premium content
    subStatus = "active" -> PASS
    tierRank("free") >= tierRank("premium") -> 0 >= 3 -> FAIL
    Result: DENIED — "Tier too low"

  Scenario 3: Premium user, active subscription, requests any content
    subStatus = "active" -> PASS
    tierRank("premium") >= tierRank(anything) -> 3 >= 0/1/2/3 -> PASS
    Result: ALLOWED

  Scenario 4: Premium user, EXPIRED subscription, requests any content
    subStatus = "expired" -> FAIL
    Result: DENIED — "Subscription inactive"
    (The tier check is never reached because the first condition fails)

  Scenario 5: Any user, subStatus = "none" (never subscribed), requests content
    subStatus = "none" -> FAIL
    Result: DENIED — "Subscription inactive"

KEY POINT: Even if you are a premium user, once your subscription expires,
you cannot access ANY paid content. The tier stays on your account (showing
your last plan), but access is gated on subStatus being "active".

NOTE ON FREE CONTENT: Looking at the code, free content also requires an
active subscription to access. In a production system you might want free
content to be accessible without a subscription, but for this demo, the
tier check applies uniformly. This simplifies the logic and makes the demo
cleaner. If the lecturer asks, you can explain this was a deliberate
simplification for the academic demo.

================================================================================
SECTION 8 — THE 70/30 PAYMENT SIMULATION EXPLAINED
================================================================================

In paymentLambda, the core payment logic is a single line:

  const success = Math.random() < 0.7;

HOW IT WORKS:
  Math.random() returns a random decimal between 0 (inclusive) and 1
  (exclusive). For example: 0.123, 0.567, 0.891, 0.034, etc.

  "< 0.7" means: if the random number is less than 0.7, success is true.
  Numbers from 0.000 to 0.699 -> true  (that is 70% of the range)
  Numbers from 0.700 to 0.999 -> false (that is 30% of the range)

  So approximately 70% of the time, the payment "succeeds".
  And approximately 30% of the time, the payment "fails".

WHAT HAPPENS ON EACH OUTCOME:

  SUCCESS (70%):
    1. DynamoDB is updated: tier set to chosen tier, subStatus set to "active"
    2. Step Functions execution is started (5-second countdown begins)
    3. PAYMENT_SUCCESS message is published to SNS
    -> User gets a success email
    -> After 5 seconds, subscription expires, user gets expiry email

  FAILURE (30%):
    1. PAYMENT_FAILED message is published to SNS
    -> User gets a failure email
    -> DynamoDB is NOT updated (tier and subStatus stay as they were)
    -> Step Functions is NOT started (no countdown)

WHY THIS DESIGN?
  In a real app, this would be replaced with a real payment gateway (Stripe,
  PayPal, etc.) that returns success or failure based on actual payment
  processing. The 70/30 simulation exists solely so we can demonstrate
  BOTH email templates during the live demo. Without it, we would have no
  way to trigger the failure path.

DEMO TIP: During the presentation, if the first attempt fails, just say
"This demonstrates our payment failure handling — notice the failure email
was sent" and click Subscribe again. It will succeed within a few tries.

================================================================================
SECTION 9 — S3 AND SIGNED URLS EXPLAINED
================================================================================

WHAT IS A PRE-SIGNED URL?
  A pre-signed URL is a special URL that grants temporary access to a
  private S3 object. It includes a cryptographic signature that proves
  the URL was generated by someone with permission to access the file.
  After the URL expires (we set 30 seconds), it stops working.

  Think of it like a time-limited VIP pass. The bouncer (S3) checks the
  pass, sees it was issued by the club owner (our Lambda with S3 access),
  checks it has not expired, and lets you in. Without the pass, or with
  an expired pass, you are denied.

HOW IT WORKS IN OUR PROJECT:

  1. Media files are stored in S3 bucket "subscription-platform-media"
     with Block Public Access ENABLED. Nobody can access them directly.

  2. When a user requests content (GET /content/:id), appLambda:
     a) Verifies the user's identity (JWT)
     b) Checks the user's subscription status and tier (DynamoDB)
     c) If authorized, generates a pre-signed URL for the file:
        generateSignedUrl("premium/aws-security.mp4")
     d) Returns the signed URL to the frontend

  3. The frontend uses the signed URL to load/play the content.
     The URL looks something like:
     https://subscription-platform-media.s3.ap-southeast-1.amazonaws.com/
     premium/aws-security.mp4?X-Amz-Algorithm=...&X-Amz-Signature=...

  4. After 30 seconds, the URL expires. Any attempt to use it returns
     an access denied error from S3.

WHY 30 SECONDS?
  Our subscription lasts 5 seconds. A 30-second URL expiry gives enough
  time for the content to load and play/display, while still expiring
  relatively quickly. In a real app, you might use 15 minutes or an hour.

WHY NOT JUST MAKE FILES PUBLIC?
  If files were public, anyone could share the direct URL and bypass
  the subscription system entirely. Pre-signed URLs ensure that:
  1. Only authenticated, authorized users can get a valid URL
  2. The URL expires, preventing long-term sharing
  3. Each URL is unique — you cannot guess or construct one

================================================================================
SECTION 10 — SES SANDBOX MODE — CRITICAL FOR DEMO
================================================================================

THIS IS THE #1 THING THAT WILL BREAK YOUR DEMO IF YOU FORGET IT.

WHAT IS SANDBOX MODE?
  When you first set up SES, it is in "sandbox" mode. This is a safety
  feature AWS uses to prevent new accounts from being used to send spam.
  In sandbox mode:
    - You can ONLY send emails TO verified email addresses
    - You can ONLY send emails FROM verified email addresses
    - There is a sending limit of 200 emails per day

  For production use, you would request to move out of sandbox mode. For
  our academic demo, sandbox mode is fine — we just need to verify our
  email addresses.

STEPS TO VERIFY AN EMAIL ADDRESS:

  1. Go to AWS Console -> SES (Simple Email Service)
  2. Make sure you are in the correct region (ap-southeast-1)
  3. In the left sidebar, click "Verified Identities"
  4. Click "Create Identity"
  5. Choose "Email address"
  6. Enter the email address (e.g., teammate1@gmail.com)
  7. Click "Create Identity"
  8. AWS sends a verification email to that address
  9. Open the email and click the verification link
  10. The status in SES will change from "Pending" to "Verified"

EMAILS TO VERIFY (DO THIS ON DAY 1):

  - The SENDER email: whatever you put in the SENDER_EMAIL env var on
    notificationLambda (e.g., noreply@yourdomain.com or a team member's
    personal email)
  - Every team member's personal email (for testing)
  - The demo recipient email (the email you will use during the live demo)
  - Any email the lecturer might want to test with (ask in advance)

IF YOU FORGET:
  notificationLambda will throw an error like:
  "Email address is not verified. The following identities failed the
   check in region AP-SOUTHEAST-1: recipient@example.com"
  The email will not be sent. The Lambda will show an error in CloudWatch
  logs. During the demo, this looks like the system is broken.

VERIFY EMAILS EARLY. DO NOT LEAVE THIS FOR THE DAY OF THE DEMO.

================================================================================
SECTION 11 — IAM ROLES AND PERMISSIONS — WHAT EACH LAMBDA NEEDS
================================================================================

Every Lambda function runs under an IAM "execution role." This role
determines which AWS services the Lambda can interact with. If a Lambda
tries to access a service it does not have permission for, it gets an
"Access Denied" error.

HOW TO CREATE AN IAM ROLE FOR A LAMBDA:

  1. Go to AWS Console -> IAM -> Roles -> Create Role
  2. Trusted entity type: AWS Service
  3. Use case: Lambda
  4. Click Next
  5. Search for and attach the policies listed below for each Lambda
  6. Click Next
  7. Name the role (use the naming convention below)
  8. Click "Create Role"

THEN ASSIGN THE ROLE TO YOUR LAMBDA:

  9. Go to Lambda -> [your function] -> Configuration -> Permissions
  10. Click the execution role link
  11. OR when creating the Lambda, choose "Use an existing role" and
      select the role you just created

ROLE NAMES AND REQUIRED POLICIES:

  Role: app-lambda-role
  For: appLambda
  Policies to attach:
    - AmazonDynamoDBFullAccess    (read/write Users and Content tables)
    - AmazonS3ReadOnlyAccess      (generate pre-signed URLs for media)
    - CloudWatchLogsFullAccess    (write logs)

  Role: payment-lambda-role
  For: paymentLambda
  Policies to attach:
    - AmazonDynamoDBFullAccess    (update user subscription in Users table)
    - AmazonSNSFullAccess          (publish payment result to SNS topic)
    - AWSStepFunctionsFullAccess   (start Step Functions execution)
    - CloudWatchLogsFullAccess    (write logs)

  Role: expiration-lambda-role
  For: expirationLambda
  Policies to attach:
    - AmazonDynamoDBFullAccess    (update subStatus to "expired")
    - AmazonSNSFullAccess          (publish SUBSCRIPTION_EXPIRED to SNS)
    - CloudWatchLogsFullAccess    (write logs)

  Role: notification-lambda-role
  For: notificationLambda
  Policies to attach:
    - AmazonSESFullAccess          (send emails)
    - CloudWatchLogsFullAccess    (write logs)

NOTE FOR YOUR WRITTEN REPORT:
  In a production system, you would NOT use "FullAccess" policies. You would
  create custom policies following the Least Privilege Principle — only
  granting the exact actions on the exact resources needed. For example:
    Instead of AmazonDynamoDBFullAccess, you would allow only:
      dynamodb:GetItem, dynamodb:PutItem, dynamodb:UpdateItem, dynamodb:Query
    on specific table ARNs:
      arn:aws:dynamodb:ap-southeast-1:ACCOUNT_ID:table/Users
      arn:aws:dynamodb:ap-southeast-1:ACCOUNT_ID:table/Users/index/email-index
      arn:aws:dynamodb:ap-southeast-1:ACCOUNT_ID:table/Content

  For the demo, FullAccess is fine. But mentioning Least Privilege in your
  report shows security awareness and will earn marks.

================================================================================
SECTION 12 — STEP-BY-STEP AWS CONSOLE SETUP (DO THESE IN ORDER)
================================================================================

Follow these steps IN ORDER on the day you set up the AWS environment.
Skipping ahead or doing them out of order will cause dependency issues.

PRE-REQUISITE: Make sure you are in the ap-southeast-1 (Singapore) region.
Check the region selector in the top-right of the AWS Console.

STEP 1 — CREATE IAM ROLES
  Create all four IAM roles as described in Section 11 above.
  Do this FIRST because you will need to assign roles when creating Lambdas.

STEP 2 — CREATE DYNAMODB USERS TABLE
  Go to DynamoDB -> Create Table
    Table name: Users
    Partition key: userId (String)
    Leave sort key empty
    Use default settings
  Click Create Table. Wait for status to become "Active".

STEP 3 — ADD GSI ON USERS TABLE
  Go to DynamoDB -> Tables -> Users -> Indexes tab -> Create Index
    Partition key: email (String)
    Index name: email-index
    Leave sort key empty
  Click Create Index. Wait for status to become "Active" (1-2 minutes).

STEP 4 — CREATE DYNAMODB CONTENT TABLE
  Go to DynamoDB -> Create Table
    Table name: Content
    Partition key: contentId (String)
    Leave sort key empty
  Click Create Table.

STEP 5 — ADD SAMPLE CONTENT ITEMS
  Go to DynamoDB -> Tables -> Content -> Explore Table Items -> Create Item
  Switch to JSON view and add all 8 content items (see Section at bottom
  of this guide for the exact JSON).

STEP 6 — CREATE S3 BUCKET
  Go to S3 -> Create Bucket
    Bucket name: subscription-platform-media
    Region: ap-southeast-1
    Block all public access: CHECKED (leave enabled)
  Click Create Bucket.

  Then go inside the bucket and create these "folders":
    free/
    basic/
    standard/
    premium/
    thumbnail/

  Upload placeholder files to each path matching the s3Key values in the
  Content table (see Section at the bottom for paths).

STEP 7 — CREATE SNS TOPIC
  Go to SNS -> Topics -> Create Topic
    Type: Standard
    Name: subscription-notifications
  Click Create Topic.
  COPY THE TOPIC ARN — you need it for paymentLambda and expirationLambda
  environment variables.

STEP 8 — VERIFY EMAILS IN SES
  Go to SES -> Verified Identities -> Create Identity
  Verify:
    - Your sender email (for SENDER_EMAIL env var)
    - All team members' personal emails
    - The demo recipient email
  Click verification links in each inbox.

STEP 9 — CREATE LAMBDA FUNCTIONS
  Go to Lambda -> Create Function -> Author from scratch

  Function 1: appLambda
    Runtime: Node.js 20.x
    Execution role: app-lambda-role
    Handler: src/lambda.handler (set in Configuration -> General after creation)
    Memory: 512 MB
    Timeout: 15 seconds

  Function 2: paymentLambda
    Runtime: Node.js 20.x
    Execution role: payment-lambda-role
    Handler: index.handler
    Memory: 256 MB
    Timeout: 10 seconds

  Function 3: expirationLambda
    Runtime: Node.js 20.x
    Execution role: expiration-lambda-role
    Handler: index.handler
    Memory: 256 MB
    Timeout: 15 seconds

  Function 4: notificationLambda
    Runtime: Node.js 20.x
    Execution role: notification-lambda-role
    Handler: index.handler
    Memory: 256 MB
    Timeout: 15 seconds

STEP 10 — SET ENVIRONMENT VARIABLES ON EACH LAMBDA
  Go to Lambda -> [function] -> Configuration -> Environment Variables -> Edit

  appLambda:
    JWT_SECRET = (your secret string)
    AWS_REGION = ap-southeast-1
    USERS_TABLE = Users
    CONTENT_TABLE = Content
    MEDIA_BUCKET = subscription-platform-media

  paymentLambda:
    AWS_REGION = ap-southeast-1
    USERS_TABLE = Users
    STATE_MACHINE_ARN = (from Step 12)
    SNS_TOPIC_ARN = (from Step 7)

  expirationLambda:
    AWS_REGION = ap-southeast-1
    USERS_TABLE = Users
    SNS_TOPIC_ARN = (from Step 7)

  notificationLambda:
    SENDER_EMAIL = (your verified sender email)

  NOTE: For paymentLambda, you will need to come back and set
  STATE_MACHINE_ARN after creating the Step Functions state machine in
  Step 12.

STEP 11 — DEPLOY LAMBDA CODE (ZIP AND UPLOAD)

  On your local machine:

  # appLambda
  cd backend/app-lambda
  npm install
  zip -r appLambda.zip .
  # Go to Lambda Console -> appLambda -> Code -> Upload from -> .zip file

  # paymentLambda
  cd backend/payment-lambda
  npm install
  zip -r paymentLambda.zip .
  # Go to Lambda Console -> paymentLambda -> Code -> Upload from -> .zip file

  # expirationLambda
  cd backend/expiration-lambda
  npm install
  zip -r expirationLambda.zip .
  # Go to Lambda Console -> expirationLambda -> Code -> Upload from -> .zip file

  # notificationLambda
  cd backend/notification-lambda
  npm install
  zip -r notificationLambda.zip .
  # Go to Lambda Console -> notificationLambda -> Code -> Upload from -> .zip file

  IMPORTANT: The ZIP must include the node_modules/ directory and all source
  files. Lambda does not run "npm install" for you.

STEP 12 — CREATE STEP FUNCTIONS STATE MACHINE
  Go to Step Functions -> State Machines -> Create State Machine
  Choose: Write your workflow in code
  Type: Standard
  Paste the JSON from infra/stepfunctions/subscription-expiration-workflow.json
  BUT FIRST: replace REPLACE_WITH_EXPIRATION_LAMBDA_ARN with the actual ARN
  of your expirationLambda. You can find the ARN on the Lambda console page
  for expirationLambda, at the top.
  Name: subscription-expiration-workflow
  Permissions: Create a new role (or use one with Lambda invoke + logs)
  Click Create.
  COPY THE STATE MACHINE ARN — you need it for paymentLambda's
  STATE_MACHINE_ARN environment variable. Go back and set it now.

STEP 13 — SUBSCRIBE notificationLambda TO SNS TOPIC
  Go to SNS -> Topics -> subscription-notifications -> Create Subscription
    Protocol: AWS Lambda
    Endpoint: select notificationLambda's ARN
  Click Create Subscription.
  Status should immediately show "Confirmed" (Lambda subscriptions auto-confirm).

STEP 14 — CREATE API GATEWAY HTTP API
  Go to API Gateway -> Create API -> HTTP API -> Build
  API name: subscription-platform-api

  Add Integrations:
    Integration 1: Lambda -> appLambda
    Integration 2: Lambda -> paymentLambda

  Add Routes:
    Route 1: ANY /{proxy+} -> appLambda integration
    Route 2: POST /subscribe -> paymentLambda integration

  Configure CORS:
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
    Access-Control-Allow-Headers: Content-Type, Authorization
    Access-Control-Max-Age: 300

  Deploy stage: $default (auto-deploy)

  COPY THE INVOKE URL — this is your VITE_API_URL for the frontend.
  It looks like: https://abc123xyz.execute-api.ap-southeast-1.amazonaws.com

STEP 15 — CREATE CLOUDWATCH DASHBOARD
  Go to CloudWatch -> Dashboards -> Create Dashboard
  Name: SubscriptionPlatform
  Add widgets:
    - Lambda Invocations (select all 4 functions)
    - Lambda Errors (select all 4 functions)
    - Lambda Duration (select all 4 functions)
    - API Gateway requests and errors

================================================================================
SECTION 13 — ENVIRONMENT VARIABLES MASTER LIST
================================================================================

Here is every environment variable used across the entire project, organized
by component. The "Where to get it" column tells you exactly where to find
the value in the AWS Console.

APP LAMBDA (appLambda):
  JWT_SECRET      = Any long random string you choose (e.g., "mySuperS3cretKey-2024")
  AWS_REGION      = ap-southeast-1
  USERS_TABLE     = Users (must match exactly the DynamoDB table name)
  CONTENT_TABLE   = Content (must match exactly the DynamoDB table name)
  MEDIA_BUCKET    = subscription-platform-media (must match exactly the S3 bucket name)

PAYMENT LAMBDA (paymentLambda):
  AWS_REGION        = ap-southeast-1
  USERS_TABLE       = Users
  STATE_MACHINE_ARN = Go to Step Functions -> State Machines -> click your
                      state machine -> copy the ARN from the details panel
                      (format: arn:aws:states:ap-southeast-1:ACCOUNT:stateMachine:name)
  SNS_TOPIC_ARN     = Go to SNS -> Topics -> subscription-notifications ->
                      copy the ARN from the details panel
                      (format: arn:aws:sns:ap-southeast-1:ACCOUNT:subscription-notifications)

EXPIRATION LAMBDA (expirationLambda):
  AWS_REGION      = ap-southeast-1
  USERS_TABLE     = Users
  SNS_TOPIC_ARN   = Same as paymentLambda's SNS_TOPIC_ARN

NOTIFICATION LAMBDA (notificationLambda):
  SENDER_EMAIL    = The email address you verified in SES that you want to
                    appear as the "From" address. Must be verified in SES.
                    Example: noreply@yourdomain.com or your-email@gmail.com

FRONTEND (.env):
  VITE_API_URL    = Go to API Gateway -> APIs -> subscription-platform-api ->
                    Stages -> $default -> copy the Invoke URL
                    (format: https://abc123.execute-api.ap-southeast-1.amazonaws.com)

================================================================================
SECTION 14 — HOW TO DEPLOY EACH LAMBDA
================================================================================

Each Lambda is deployed as a ZIP file uploaded through the AWS Console.

GENERAL PROCESS:
  1. Navigate to the Lambda's directory on your local machine
  2. Run "npm install" to install dependencies
  3. Create a ZIP of the entire directory (including node_modules)
  4. Upload the ZIP via the Lambda console

SPECIFIC COMMANDS:

  appLambda:
    cd backend/app-lambda
    npm install
    zip -r appLambda.zip .
    Upload to AWS: Lambda -> appLambda -> Code tab -> Upload from -> .zip file
    Configuration settings:
      Handler: src/lambda.handler
      Runtime: Node.js 20.x
      Memory: 512 MB
      Timeout: 15 seconds

  paymentLambda:
    cd backend/payment-lambda
    npm install
    zip -r paymentLambda.zip .
    Upload to AWS: Lambda -> paymentLambda -> Code tab -> Upload from -> .zip file
    Configuration settings:
      Handler: index.handler
      Runtime: Node.js 20.x
      Memory: 256 MB
      Timeout: 10 seconds

  expirationLambda:
    cd backend/expiration-lambda
    npm install
    zip -r expirationLambda.zip .
    Upload to AWS: Lambda -> expirationLambda -> Code tab -> Upload from -> .zip file
    Configuration settings:
      Handler: index.handler
      Runtime: Node.js 20.x
      Memory: 256 MB
      Timeout: 15 seconds

  notificationLambda:
    cd backend/notification-lambda
    npm install
    zip -r notificationLambda.zip .
    Upload to AWS: Lambda -> notificationLambda -> Code tab -> Upload from -> .zip file
    Configuration settings:
      Handler: index.handler
      Runtime: Node.js 20.x
      Memory: 256 MB
      Timeout: 15 seconds

WINDOWS NOTE:
  If you are on Windows and do not have the "zip" command, you can:
    - Use PowerShell: Compress-Archive -Path * -DestinationPath ../appLambda.zip
    - Or use 7-Zip: right-click -> 7-Zip -> Add to archive -> ZIP format
    - Or install Git Bash which includes zip

IMPORTANT: The ZIP must contain files at the ROOT level. When you unzip it,
you should see package.json, node_modules/, src/ (or index.js) directly —
NOT inside another folder. If the ZIP contains a folder like "app-lambda/"
at the root, Lambda will not find your handler.

================================================================================
SECTION 15 — HOW TO RUN THE FRONTEND
================================================================================

The frontend is a React app built with Vite.

LOCAL DEVELOPMENT:

  cd frontend
  npm install
  npm install react-router-dom
  cp .env.example .env

  Now edit .env and set VITE_API_URL:
    VITE_API_URL=https://your-api-gateway-url.execute-api.ap-southeast-1.amazonaws.com

  Then run:
    npm run dev

  This starts a local development server (usually at http://localhost:5173).
  Open it in your browser.

PRODUCTION BUILD (FOR DEPLOYMENT):

  npm run build

  This creates a "dist/" folder with static HTML, CSS, and JS files.
  You can deploy this to:
    - Vercel: connect your GitHub repo, Vercel auto-detects Vite
    - S3 static hosting: upload dist/ contents to an S3 bucket configured
      for static website hosting
    - Any static file hosting service

IMPORTANT: Vite environment variables must start with VITE_ to be accessible
in the frontend code. That is why we use VITE_API_URL, not just API_URL.
Variables without the VITE_ prefix are not exposed to the browser (this is
a security feature to prevent accidentally leaking server-side secrets).

================================================================================
SECTION 16 — FULL SYSTEM TEST PLAN (DO THESE IN ORDER)
================================================================================

After deploying everything, run through this test plan systematically.
Each test builds on the previous one. If a test fails, fix the issue before
moving to the next test.

TEST 1 — HEALTH CHECK
  Method: GET
  URL: {API_GATEWAY_URL}/
  Expected: { "message": "Subscription Platform API" }
  If this fails: API Gateway or appLambda is misconfigured.

TEST 2 — REGISTER A USER
  Method: POST
  URL: {API_GATEWAY_URL}/auth/register
  Body: { "email": "test@gmail.com", "password": "123456" }
  Expected: { "success": true, "userId": "some-uuid-string" }
  If this fails: Check appLambda logs in CloudWatch. Common issues:
    - DynamoDB Users table does not exist
    - appLambda does not have DynamoDBFullAccess
    - USERS_TABLE env var is wrong

TEST 3 — LOGIN
  Method: POST
  URL: {API_GATEWAY_URL}/auth/login
  Body: { "email": "test@gmail.com", "password": "123456" }
  Expected: { "success": true, "token": "eyJhbG...", "user": {...} }
  If this fails: Check email-index GSI exists. This is the #1 cause of
  login failures. Also check JWT_SECRET env var is set.

TEST 4 — CHECK USER STATUS
  Method: GET
  URL: {API_GATEWAY_URL}/user/status
  Headers: Authorization: Bearer {token from Test 3}
  Expected: { "tier": "free", "status": "none", "email": "test@gmail.com" }

TEST 5 — LIST CONTENT
  Method: GET
  URL: {API_GATEWAY_URL}/content
  Headers: Authorization: Bearer {token}
  Expected: Array of content objects WITHOUT s3Key field.
  Each object should have: contentId, title, description, requiredTier, type

TEST 6 — ACCESS PREMIUM CONTENT (SHOULD FAIL)
  Method: GET
  URL: {API_GATEWAY_URL}/content/VID007
  Headers: Authorization: Bearer {token}
  Expected: { "error": "Subscription inactive" }
  The user is free tier with no active subscription — access denied.

TEST 7 — SUBSCRIBE
  Method: POST
  URL: {API_GATEWAY_URL}/subscribe
  Body: { "userId": "{from Test 2}", "email": "test@gmail.com", "tier": "premium" }
  Expected: { "success": true } OR { "success": false }
  Run this several times. You should see roughly 70% success, 30% failure.

TEST 8 — VERIFY DYNAMODB UPDATE (ON SUCCESS)
  Go to DynamoDB -> Tables -> Users -> Explore Table Items
  Find your user. Check:
    tier: "premium"
    subStatus: "active"
    subStart: (a recent ISO timestamp)

TEST 9 — CHECK SUCCESS EMAIL
  Open the inbox for test@gmail.com.
  You should have received a "Subscription Activated" email.
  If not: Check notificationLambda CloudWatch logs. Common issues:
    - Email not verified in SES
    - notificationLambda not subscribed to SNS topic
    - SENDER_EMAIL not verified

TEST 10 — ACCESS PREMIUM CONTENT (SHOULD SUCCEED)
  Method: GET
  URL: {API_GATEWAY_URL}/content/VID007
  Headers: Authorization: Bearer {token}
  Expected: { "contentId": "VID007", "title": "...", "url": "https://s3...signed..." }
  Do this quickly — you only have 5 seconds before expiry!

TEST 11 — WAIT 5 SECONDS
  Just wait.

TEST 12 — VERIFY DYNAMODB EXPIRY
  Refresh DynamoDB -> Users table.
  subStatus should now be "expired".

TEST 13 — CHECK EXPIRY EMAIL
  Check inbox for "Subscription Expired" email.

TEST 14 — ACCESS PREMIUM CONTENT AGAIN (SHOULD FAIL)
  Method: GET
  URL: {API_GATEWAY_URL}/content/VID007
  Headers: Authorization: Bearer {token}
  Expected: { "error": "Subscription inactive" }

TEST 15 — PAYMENT FAILURE EMAIL
  Trigger a payment failure (run Test 7 until you get { success: false }).
  Check inbox for "Payment Failed" email.

TEST 16 — CHECK CLOUDWATCH LOGS
  Go to CloudWatch -> Log Groups.
  You should see log groups for all four Lambdas:
    /aws/lambda/appLambda
    /aws/lambda/paymentLambda
    /aws/lambda/expirationLambda
    /aws/lambda/notificationLambda
  Click into each one and verify recent log entries exist.

================================================================================
SECTION 17 — PRESENTATION DEMO SCRIPT (EXACT STEPS FOR LIVE DEMO)
================================================================================

BEFORE THE DEMO — PREPARE THESE BROWSER TABS:

  Tab 1: React frontend (your deployed URL or localhost:5173)
  Tab 2: DynamoDB -> Tables -> Users -> Explore Table Items
  Tab 3: Step Functions -> State Machines -> subscription-expiration-workflow
         -> Executions
  Tab 4: CloudWatch -> Log Groups (or your dashboard)
  Tab 5: Email inbox for the demo recipient

  Also have these ready but not necessarily open:
  - Architecture diagram (from README or drawn on a slide)
  - The TEAM_GUIDE.txt open for quick reference

DEMO FLOW:

  STEP 1 — SHOW ARCHITECTURE (1-2 minutes)
    "Here is our architecture. We have a React frontend talking to API
    Gateway, which routes to four Lambda functions. Here's how they
    connect..." Walk through the ASCII diagram from the README.

  STEP 2 — REGISTER A USER (Tab 1)
    Navigate to the Register page.
    Enter a fresh email (use the verified demo email) and a password.
    Click Register. Show the success response.
    "We just created a new user. The password was hashed with bcrypt
    before being stored — we never store plain text passwords."

  STEP 3 — LOG IN (Tab 1)
    Navigate to the Login page.
    Enter the same credentials. Click Login.
    "We received a JWT token. This token carries the user's identity
    and is signed with a secret key. We use JWT instead of sessions
    because Lambda is stateless."

  STEP 4 — SHOW CONTENT LIST (Tab 1)
    You should be redirected to the Content page.
    "Here is our content library. Notice the tier labels — free, basic,
    standard, premium. The s3Key is NOT exposed in this response for
    security — you cannot guess the file locations."

  STEP 5 — TRY ACCESSING PREMIUM CONTENT — SHOULD FAIL (Tab 1)
    Click on a premium content item.
    Show the "Subscription inactive" error.
    "As a free user with no active subscription, we cannot access
    premium content. The backend checks two conditions: active subscription
    AND sufficient tier rank."

  STEP 6 — NAVIGATE TO SUBSCRIPTION PAGE (Tab 1)
    Go to the Subscription page.
    Select "Premium" from the dropdown.

  STEP 7 — CLICK SUBSCRIBE (Tab 1)
    Click "Subscribe Premium".
    Wait for the response.

  IF SUCCESS (70% chance):

    STEP 8 — SHOW SUCCESS RESULT
      "Payment succeeded! Our simulation uses a 70/30 random split.
      Three things just happened in the backend:
      1. DynamoDB was updated with tier=premium, subStatus=active
      2. A Step Functions execution started with a 5-second timer
      3. A success notification was published to SNS"

    STEP 9 — SHOW SUCCESS EMAIL (Tab 5)
      Switch to the email tab. Refresh if needed.
      "Here's the confirmation email sent via SES."

    STEP 10 — SHOW DYNAMODB UPDATE (Tab 2)
      Switch to DynamoDB. Refresh the items.
      Point out: tier = "premium", subStatus = "active"
      "The database now reflects the active premium subscription."

    STEP 11 — ACCESS PREMIUM CONTENT (Tab 1)
      Go back to Content page. Click the premium content item.
      It should now return a signed URL.
      "Now we can access premium content. The backend generated a
      pre-signed S3 URL valid for 30 seconds."

    STEP 12 — WATCH THE COUNTDOWN (Tab 1)
      Switch to Subscription page. Watch the countdown reach 0.
      "The subscription lasts 5 seconds for demo purposes. In
      production this would be 30 days."

    STEP 13 — SHOW STEP FUNCTIONS COMPLETION (Tab 3)
      Switch to Step Functions. Show the execution that just completed.
      "The state machine waited 5 seconds and then invoked our
      expiration Lambda. We used Step Functions instead of EventBridge
      because EventBridge cannot schedule events less than 1 minute
      in the future."

    STEP 14 — SHOW DYNAMODB EXPIRY (Tab 2)
      Refresh DynamoDB. subStatus should now be "expired".
      "The subscription has expired. The expiration Lambda updated
      DynamoDB."

    STEP 15 — SHOW EXPIRY EMAIL (Tab 5)
      Check email for the "Subscription Expired" message.
      "The user was notified via email that their subscription expired."

    STEP 16 — TRY PREMIUM CONTENT AGAIN — SHOULD FAIL (Tab 1)
      Go back and try accessing premium content.
      Show the "Subscription inactive" error.
      "Even though the user's tier is still premium, the subscription
      status is expired, so access is denied."

    STEP 17 — SHOW CLOUDWATCH LOGS (Tab 4)
      Show Lambda logs for all four functions.
      "We can monitor all Lambda invocations, errors, and duration
      through CloudWatch."

  IF FAILURE (30% chance):

    STEP 8 — SHOW FAILURE RESULT
      "Payment failed — this demonstrates our 30% failure path.
      No database update occurred, no Step Functions execution
      was started. Only a failure notification was sent to SNS."

    STEP 9 — SHOW FAILURE EMAIL (Tab 5)
      Show the "Payment Failed" email.

    STEP 10 — TRY AGAIN
      "Let me try again — statistically it will succeed within
      a few attempts."
      Click Subscribe again. Repeat until success, then continue
      with the success flow above.

================================================================================
SECTION 18 — COMMON ERRORS AND HOW TO FIX THEM
================================================================================

ERROR: "Access Denied" from S3 when trying to access content
  CAUSE: appLambda's IAM role does not have S3 read access, or the bucket
         name in MEDIA_BUCKET does not match the actual bucket name.
  FIX:
    1. Go to IAM -> Roles -> app-lambda-role -> check AmazonS3ReadOnlyAccess
       is attached.
    2. Go to Lambda -> appLambda -> Configuration -> Environment Variables ->
       verify MEDIA_BUCKET = "subscription-platform-media" (exact match).
    3. Verify the file actually exists at the s3Key path in the bucket.

ERROR: 500 Internal Server Error from /auth/login
  CAUSE: The email-index GSI does not exist on the Users table, or the
         index name in the code does not match.
  FIX:
    1. Go to DynamoDB -> Tables -> Users -> Indexes tab.
    2. If there is no index, create one: Partition key = email, Index name
       = email-index.
    3. If the index exists but has a different name, either rename it or
       update the IndexName in backend/app-lambda/src/services/userService.js.
    4. Wait for index status to be "Active" before testing again.

ERROR: Emails are not arriving
  CAUSE: Recipient or sender email is not verified in SES (sandbox mode).
  FIX:
    1. Go to SES -> Verified Identities.
    2. Check that BOTH the sender email (SENDER_EMAIL env var) and the
       recipient email are listed with status "Verified".
    3. If not, add them and click the verification links.
    4. Also check: SNS -> Topics -> subscription-notifications ->
       Subscriptions. Verify notificationLambda is listed as a subscriber
       with status "Confirmed".
    5. Check notificationLambda CloudWatch logs for error details.

ERROR: Step Functions not triggering expiration after 5 seconds
  CAUSE: STATE_MACHINE_ARN is wrong, or paymentLambda does not have
         Step Functions permission, or the state machine's Lambda ARN
         is still the placeholder.
  FIX:
    1. Go to Lambda -> paymentLambda -> Environment Variables -> verify
       STATE_MACHINE_ARN matches the ARN in Step Functions console.
    2. Go to IAM -> payment-lambda-role -> verify AWSStepFunctionsFullAccess.
    3. Go to Step Functions -> state machine -> Definition -> check that
       REPLACE_WITH_EXPIRATION_LAMBDA_ARN was replaced with the actual
       expirationLambda ARN.

ERROR: CORS error in browser console
  CAUSE: API Gateway CORS is not configured, or is missing required headers.
  FIX:
    1. Go to API Gateway -> subscription-platform-api -> CORS -> Configure.
    2. Set: Allow Origins = *, Allow Methods = *, Allow Headers =
       "Content-Type, Authorization".
    3. Save and redeploy (usually auto-deploys with HTTP API).

ERROR: "Subscription inactive" even right after subscribing
  CAUSE: The frontend's local storage user object has stale subStatus.
         The backend is correct (DynamoDB is updated), but the frontend
         is showing old data.
  FIX:
    After subscribing, call getStatus() to refresh the user's status
    from the backend. The backend always reads from DynamoDB, so the
    API response is always accurate.

ERROR: Lambda timeout (Task timed out after X seconds)
  CAUSE: The Lambda ran out of time before completing execution.
  FIX:
    Go to Lambda -> [function] -> Configuration -> General Configuration ->
    increase Timeout. appLambda should be at least 15 seconds. For cold
    starts (first invocation after a period of inactivity), Lambda can
    take a few seconds to initialize.

ERROR: "Cannot find module" in Lambda logs
  CAUSE: node_modules was not included in the ZIP file, or the ZIP has
         files inside a subdirectory instead of at the root.
  FIX:
    Make sure you run "npm install" BEFORE creating the ZIP. The ZIP should
    contain package.json and node_modules/ at the root level — not inside
    a subdirectory. If you unzip the file, you should see package.json
    immediately, not inside a folder.

ERROR: "Unable to import module 'src/lambda'" or "Unable to import module 'index'"
  CAUSE: The Handler setting in Lambda does not match the file structure.
  FIX:
    appLambda handler should be: src/lambda.handler
    All other Lambdas handler should be: index.handler
    Check Lambda -> Configuration -> General Configuration -> Handler.

ERROR: DynamoDB "ValidationException: Value provided in ExpressionAttributeNames
unused in expressions"
  CAUSE: You defined ExpressionAttributeNames but did not use the alias
         in your UpdateExpression.
  FIX:
    If you have "#tier": "tier" in ExpressionAttributeNames, make sure
    your UpdateExpression uses #tier, not tier.

================================================================================
END OF TEAM GUIDE
================================================================================

SAMPLE CONTENT DATA TO SEED INTO DYNAMODB CONTENT TABLE:

(Use DynamoDB -> Tables -> Content -> Explore Items -> Create Item -> JSON view)

Item 1:
{
  "contentId": { "S": "VID001" },
  "title": { "S": "Cloud Computing Fundamentals" },
  "description": { "S": "Introduction to AWS core services and cloud concepts." },
  "requiredTier": { "S": "free" },
  "type": { "S": "video" },
  "s3Key": { "S": "free/cloud-fundamentals.mp4" },
  "thumbnailKey": { "S": "thumbnail/cloud.jpg" }
}

Item 2:
{
  "contentId": { "S": "VID002" },
  "title": { "S": "Networking Basics on AWS" },
  "description": { "S": "VPC, subnets, security groups explained simply." },
  "requiredTier": { "S": "free" },
  "type": { "S": "video" },
  "s3Key": { "S": "free/networking-basics.mp4" },
  "thumbnailKey": { "S": "thumbnail/networking.jpg" }
}

Item 3:
{
  "contentId": { "S": "VID003" },
  "title": { "S": "AWS Lambda Deep Dive" },
  "description": { "S": "Serverless architecture patterns and best practices." },
  "requiredTier": { "S": "basic" },
  "type": { "S": "video" },
  "s3Key": { "S": "basic/lambda-deep-dive.mp4" },
  "thumbnailKey": { "S": "thumbnail/lambda.jpg" }
}

Item 4:
{
  "contentId": { "S": "VID004" },
  "title": { "S": "DynamoDB Mastery" },
  "description": { "S": "Data modelling, GSIs, and query optimization." },
  "requiredTier": { "S": "basic" },
  "type": { "S": "video" },
  "s3Key": { "S": "basic/dynamodb-mastery.mp4" },
  "thumbnailKey": { "S": "thumbnail/dynamodb.jpg" }
}

Item 5:
{
  "contentId": { "S": "VID005" },
  "title": { "S": "Kubernetes on EKS" },
  "description": { "S": "Container orchestration using AWS Elastic Kubernetes Service." },
  "requiredTier": { "S": "standard" },
  "type": { "S": "video" },
  "s3Key": { "S": "standard/kubernetes-eks.mp4" },
  "thumbnailKey": { "S": "thumbnail/kubernetes.jpg" }
}

Item 6:
{
  "contentId": { "S": "VID006" },
  "title": { "S": "CI/CD Pipelines with CodePipeline" },
  "description": { "S": "Build automated deployment pipelines on AWS." },
  "requiredTier": { "S": "standard" },
  "type": { "S": "video" },
  "s3Key": { "S": "standard/cicd-codepipeline.mp4" },
  "thumbnailKey": { "S": "thumbnail/cicd.jpg" }
}

Item 7:
{
  "contentId": { "S": "VID007" },
  "title": { "S": "Advanced AWS Security" },
  "description": { "S": "IAM hardening, GuardDuty, Security Hub deep dive." },
  "requiredTier": { "S": "premium" },
  "type": { "S": "video" },
  "s3Key": { "S": "premium/aws-security.mp4" },
  "thumbnailKey": { "S": "thumbnail/security.jpg" }
}

Item 8:
{
  "contentId": { "S": "VID008" },
  "title": { "S": "Machine Learning with SageMaker" },
  "description": { "S": "End-to-end ML pipeline on AWS SageMaker." },
  "requiredTier": { "S": "premium" },
  "type": { "S": "video" },
  "s3Key": { "S": "premium/sagemaker-ml.mp4" },
  "thumbnailKey": { "S": "thumbnail/sagemaker.jpg" }
}

NOTE: The { "S": "..." } format is DynamoDB's native JSON format. If you
are using the "Form" view in the DynamoDB console instead of "JSON" view,
just type the values directly without the { "S": "..." } wrapper.

S3 PLACEHOLDER FILES TO UPLOAD:
  free/cloud-fundamentals.mp4
  free/networking-basics.mp4
  basic/lambda-deep-dive.mp4
  basic/dynamodb-mastery.mp4
  standard/kubernetes-eks.mp4
  standard/cicd-codepipeline.mp4
  premium/aws-security.mp4
  premium/sagemaker-ml.mp4

For demo purposes, these can be tiny placeholder files. You can create them
by renaming any small file with a .mp4 extension, or recording a 1-second
video. The signed URL just needs to resolve — it does not need to be a
real, playable video for the architecture demo.
