# Travel Planner AI Agent - Capstone Project Documentation

This repository contains the architecture, workflow designs, and system integration details for the Travel Planner AI Client/Server application. The project serves as a comprehensive capstone integrating the architectural principles and technologies studied from **Week 1 through Week 5**.

---

## 🗺️ Curriculum Integration (Week 1–5 Reference)

The architecture is built upon the following learning objectives:
* **Week 1 (Foundations & DSA)**: Schema design optimization, indexing configurations on database layers, and Git branching rules for robust repository management.
* **Week 2 (Backend Engineering)**: Node.js Express application utilizing the **MVC (Model-View-Controller) Design Pattern**, global error handling middleware, request rate-limiting, logging (Morgan/Winston), and async/await processing patterns.
* **Week 3 (Frontend & UX)**: Single Page Application (SPA) designed with React, TypeScript, state management (Zustand/Context), form state handling via **React Hook Form + Zod Schema Validation**, and optimized HTTP fetches/caching using **TanStack Query**.
* **Week 4 (DevOps & Infrastructure)**: Automated build checks using GitHub Actions, containerization using Docker, secrets protection using Cloud Key Management, and Infrastructure as Code (IaC) provisioning using **Terraform on AWS (EC2, S3, CloudFront, and Security Groups)**.
* **Week 5 (Agentic AI)**: Multi-Agent design featuring specialized decision blocks (Destination, Budget, Transport, Accommodation, and Itinerary agents) orchestrated by a centralized **Coordinator Agent** running on the free **Groq LLM API**.

---

## 1. Traveler Workflow

Traces the execution path starting from client-side Zod form validation, user auth authorization, Express router middleware, agent orchestration, external API tool calling, and human-in-the-loop validation, down to MongoDB persistence.

```mermaid
graph TD
    %% Styling and config
    classDef default fill:#1e1e2e,stroke:#cdd6f4,stroke-width:2px,color:#cdd6f4;
    classDef startEnd fill:#a6e3a1,stroke:#a6e3a1,stroke-width:2px,color:#11111b;
    classDef process fill:#89b4fa,stroke:#89b4fa,stroke-width:2px,color:#11111b;
    classDef agent fill:#f9e2af,stroke:#f9e2af,stroke-width:2px,color:#11111b;
    classDef api fill:#f5c2e7,stroke:#f5c2e7,stroke-width:2px,color:#11111b;
    
    Traveler([Traveler]):::startEnd --> ClientInput["Dashboard Input Form<br/>(Client Validation: Hook Form + Zod)"]:::process
    ClientInput --> Auth["User Registration / Login<br/>JWT/RBAC Auth Middleware"]:::process
    Auth --> FetchData["Fetch User Dashboard Data<br/>(TanStack Query caching, API Pagination & Filters)"]:::process
    
    FetchData --> Create["Create New Trip Request"]:::process
    FetchData --> View["View Existing Trips"]:::process
    
    Create --> InputGoal["User enters Goal Input<br/>e.g., 'Plan a 5-day trip to Manali for 2 people within ₹30,000'"]:::process
    View --> InputGoal
    
    InputGoal --> ExpressRouter["Express.js Server Router<br/>Rate-limiting via express-rate-limit<br/>Morgan/Winston Session Logging"]:::process
    
    ExpressRouter --> Orchestrator["Coordinator Agent<br/>(Manages sub-agents: Dest, Budget, Trans, Accom, Itin)"]:::agent
    Orchestrator --> ParseIntent["Understand User Intent & Requirements"]:::process
    ParseIntent --> SplitTasks["Break Input into Agent Sub-Tasks"]:::process
    
    SplitTasks --> DestAgent["Destination Agent<br/>Select ideal location based on budget"]:::agent
    SplitTasks --> BudgetAgent["Budget Agent<br/>Ensure cost-estimates stay under threshold"]:::agent
    SplitTasks --> TransAgent["Transport Agent<br/>Plan flight/train/bus connections"]:::agent
    SplitTasks --> AccomAgent["Accommodation Agent<br/>Search hotels & homestays"]:::agent
    SplitTasks --> ItinAgent["Itinerary Agent<br/>Generate day-by-day travel schedule"]:::agent
    
    DestAgent --> Coordinator["Coordinator Agent<br/>Reconsolidates Sub-Agent Context"]:::agent
    BudgetAgent --> Coordinator
    TransAgent --> Coordinator
    AccomAgent --> Coordinator
    ItinAgent --> Coordinator
    
    Coordinator --> BuildPlan["Compile Complete Trip Document Schema"]:::process
    BuildPlan --> ToolCall["External APIs / Tool Calling<br/>OpenMeteo Weather API & Google Maps API"]:::api
    
    ToolCall --> GenPlan["Generate Final Travel Plan via Groq API (Free)<br/>(Async/Await processing)"]:::process
    GenPlan --> HITL{"Human-in-the-Loop Confirmation<br/>'Do you approve this travel plan?'"}:::process
    
    HITL -->|Approve| SaveDB["Save Trip to MongoDB Atlas<br/>(Mongoose write validations)"]:::process
    HITL -->|Reject| ModifyReq["Modify Requirements & Send Back"]:::process
    
    SaveDB --> ScheduleRem["Schedule Reminders (Calendar Integration)"]:::process
    ModifyReq --> Orchestrator
    
    ScheduleRem --> UpdateStatus["Update Trip Status<br/>(Draft ➔ Planned ➔ Confirmed)"]:::process
    UpdateStatus --> DashboardUpdate([User Dashboard UI Updated]):::startEnd
```

---

## 2. Admin Workflow

Details admin authorization, role validation middleware, navigation to administrative management sections, and metrics visualization dashboards.

```mermaid
graph TD
    classDef default fill:#1e1e2e,stroke:#cdd6f4,stroke-width:2px,color:#cdd6f4;
    classDef startEnd fill:#a6e3a1,stroke:#a6e3a1,stroke-width:2px,color:#11111b;
    classDef process fill:#89b4fa,stroke:#89b4fa,stroke-width:2px,color:#11111b;
    classDef admin fill:#f38ba8,stroke:#f38ba8,stroke-width:2px,color:#11111b;

    Admin["Admin Web Dashboard"]:::admin --> Auth["JWT Decode: Verify User Admin Role<br/>(RBAC Role Verification Middleware)"]:::process
    Auth --> DashboardREST["Admin Panel Router<br/>Rate-limited analytical endpoints"]:::process
    
    DashboardREST --> Users["View All Users<br/>(Includes Email/Status Pagination & Filters)"]:::process
    DashboardREST --> Trips["View All Trips<br/>(Status queries: Draft/Planned/Confirmed)"]:::process
    DashboardREST --> Analytics["System Metrics Dashboard<br/>(Chart.js Data Binding)"]:::process
    
    Users --> AuditLogs["Audit Access logs & User status edit"]:::process
    Trips --> SearchTrips["Query database updates with indexing logs"]:::process
    Analytics --> Stats["Display Active Users, Popular Locations,<br/>and Total Trip costs metrics"]:::process
```

---

## 3. AI Agent Internal Flow

Highlights conditional routing inside the backend agent orchestration layers for determining which services/tools need execution to complete a user request.

```mermaid
graph TD
    classDef default fill:#1e1e2e,stroke:#cdd6f4,stroke-width:2px,color:#cdd6f4;
    classDef startEnd fill:#a6e3a1,stroke:#a6e3a1,stroke-width:2px,color:#11111b;
    classDef process fill:#89b4fa,stroke:#89b4fa,stroke-width:2px,color:#11111b;
    classDef agent fill:#f9e2af,stroke:#f9e2af,stroke-width:2px,color:#11111b;
    classDef tool fill:#f5c2e7,stroke:#f5c2e7,stroke-width:2px,color:#11111b;

    Goal([User Goal]):::startEnd --> Planner["Coordinator Agent"]:::agent
    Planner --> Create["Initialize Agent Memory & Execution Sequence"]:::process
    
    %% Destination Step
    Create --> CheckDest{"Need Destination?"}:::process
    CheckDest -->|Yes| DestAgent["Destination Agent"]:::agent
    CheckDest -->|No| CheckBudget{"Need Budget?"}:::process
    DestAgent --> CheckBudget
    
    %% Budget Step
    CheckBudget -->|Yes| BudgetAgent["Budget Agent"]:::agent
    CheckBudget -->|No| CheckTransport{"Need Transport?"}:::process
    BudgetAgent --> CheckTransport
    
    %% Transport Step
    CheckTransport -->|Yes| TransportAgent["Transport Agent"]:::agent
    CheckTransport -->|No| CheckAccom{"Need Accommodation?"}:::process
    TransportAgent --> CheckAccom
    
    %% Accommodation Step
    CheckAccom -->|Yes| AccomAgent["Accommodation Agent"]:::agent
    CheckAccom -->|No| CheckItinerary{"Need Itinerary?"}:::process
    AccomAgent --> CheckItinerary
    
    %% Itinerary Step
    CheckItinerary -->|Yes| ItineraryAgent["Itinerary Agent"]:::agent
    CheckItinerary -->|No| CheckWeather{"Need Weather?"}:::process
    ItineraryAgent --> CheckWeather
    
    %% Weather Step
    CheckWeather -->|Yes| WeatherTool["Weather Tool<br/>(API Call)"]:::tool
    CheckWeather -->|No| CheckCalendar{"Need Calendar?"}:::process
    WeatherTool --> CheckCalendar
    
    %% Calendar Step
    CheckCalendar -->|Yes| CalendarTool["Calendar Tool<br/>(API Call)"]:::tool
    CheckCalendar -->|No| Coordinator["Coordinator Agent"]:::agent
    CalendarTool --> Coordinator
    
    %% Wrap-up
    Coordinator --> GenPlan["Generate Final Plan via Groq API (Free)"]:::process
    GenPlan --> AppReq{"Human Approval?"}:::process
    AppReq -->|Approved| Save["Save Trip Draft to DB"]:::process
    AppReq -->|Rejected| Planner
    Save --> End(["End"]):::startEnd
```

---

## 4. Project Development Workflow

Illustrates the Git workflow, Continuous Integration pipeline via GitHub Actions, Docker builds, Terraform IaC provisioning, and deployment endpoints on AWS.

```mermaid
graph TD
    classDef default fill:#1e1e2e,stroke:#cdd6f4,stroke-width:2px,color:#cdd6f4;
    classDef local fill:#a6e3a1,stroke:#a6e3a1,stroke-width:2px,color:#11111b;
    classDef ci fill:#89b4fa,stroke:#89b4fa,stroke-width:2px,color:#11111b;
    classDef cd fill:#f9e2af,stroke:#f9e2af,stroke-width:2px,color:#11111b;
    
    subgraph Local ["Local Development"]
        Branch["Create Feature Branch<br/>(Git Flow strategy)"]:::local
        Dev["Develop Features (Node.js/React/Express)"]:::local
        Commit["Checkin Changes (Commit message conventions)"]:::local
        Push["Push branch to GitHub Repository"]:::local
        
        Branch --> Dev --> Commit --> Push
    end
    
    subgraph CI ["GitHub Actions CI Pipeline"]
        PR["Open Pull Request to Main"]:::ci
        GA["GitHub Actions Triggered"]:::ci
        LintFormatter["Code Linting & Formatting Check"]:::ci
        Tests["Run Unit Tests (Vitest / Jest)"]:::ci
        SecurityScan["Security scan & npm audit"]:::ci
        Build["Build Production Build (Vite & ESBuild)"]:::ci
        Docker["Docker Image Build & Scan"]:::ci
        Merge["PR Review & Merge to Main"]:::ci
        
        PR --> GA --> LintFormatter --> Tests --> SecurityScan --> Build --> Docker --> Merge
    end
    
    subgraph CD ["AWS CD Pipeline & IaC Provisioning"]
        TriggerCD["CD Action Triggered"]:::cd
        SecretsRetrieve["Retrieve secrets from AWS Secrets Manager"]:::cd
        Terraform["Terraform Apply<br/>(Provision AWS VPC, EC2, S3, CloudFront)"]:::cd
        
        DepBack["Deploy Backend (Docker container on AWS EC2)"]:::cd
        DepFront["Deploy Frontend (AWS S3 + CloudFront CDN CDN invalidation)"]:::cd
        DB["MongoDB Atlas Index verification"]:::cd
        CloudWatch["Configure Prometheus/Grafana or CloudWatch Metrics"]:::cd
        Prod(["Production Live State"]):::cd
        
        TriggerCD --> SecretsRetrieve --> Terraform
        Terraform --> DepBack
        Terraform --> DepFront
        Terraform --> DB
        
        DepBack --> CloudWatch
        DepFront --> CloudWatch
        CloudWatch --> Prod
    end

    Push --> PR
    Merge --> TriggerCD
```

---

## 5. Complete System Architecture

Maps out the structural tier boundaries: Frontend Web Client, Express.js Router context, AI Agent orchestration cluster, External Integrations, and persistent database layers.

```mermaid
graph TD
    %% Styling
    classDef default fill:#1e1e2e,stroke:#cdd6f4,stroke-width:2px,color:#cdd6f4;
    classDef frontend fill:#89b4fa,stroke:#89b4fa,stroke-width:2px,color:#11111b;
    classDef backend fill:#a6e3a1,stroke:#a6e3a1,stroke-width:2px,color:#11111b;
    classDef db fill:#f9e2af,stroke:#f9e2af,stroke-width:2px,color:#11111b;
    classDef ext fill:#f5c2e7,stroke:#f5c2e7,stroke-width:2px,color:#11111b;

    %% Frontend Tier
    subgraph ClientTier ["Frontend Client (React TS - Week 3)"]
        FE["React User Interface<br/>(Tailwind CSS)"]:::frontend
        Val["Form Validation<br/>(React Hook Form + Zod)"]:::frontend
        State["State Manager<br/>(Zustand / Context API)"]:::frontend
        Queries["API Client<br/>(TanStack Query / Axios)"]:::frontend
        ChartsFE["Visualizations<br/>(Chart.js Analytics)"]:::frontend
        AuthFE["JWT Secure Storage<br/>(Cookies/LocalStorage)"]:::frontend
    end

    %% Backend Server Tier
    subgraph ServerTier ["Backend Server (Node.js/Express MVC - Week 2)"]
        API["Express.js Client Routes"]:::backend
        
        %% Middleware sub-layer
        subgraph Middlewares ["Express.js Middleware Chain"]
            Throttle["API Rate Limiter"]:::backend
            Log["Morgan Logger"]:::backend
            JWT["JWT Validation & Authorization"]:::backend
            RBAC["RBAC Role Validator"]:::backend
            ErrorM["Global Error Handler"]:::backend
        end
        
        AIPlanner["AI Agent Orchestrator (LangChain JS)"]:::backend
        
        API --> Throttle --> Log --> JWT --> RBAC --> AIPlanner
        AIPlanner -.-> ErrorM
        
        %% Sub-agents cluster
        subgraph agents ["AI Agent Cluster (Agentic AI - Week 5)"]
            DestAgent["Destination Agent"]:::backend
            BudAgent["Budget Agent"]:::backend
            TransAgent["Transport Agent"]:::backend
            AccomAgent["Accommodation Agent"]:::backend
            ItinAgent["Itinerary Agent"]:::backend
        end
        
        AIPlanner --> DestAgent
        AIPlanner --> BudAgent
        AIPlanner --> TransAgent
        AIPlanner --> AccomAgent
        AIPlanner --> ItinAgent
        
        DestAgent --> Coord["Coordinator Agent"]:::backend
        BudAgent --> Coord
        TransAgent --> Coord
        AccomAgent --> Coord
        ItinAgent --> Coord
    end

    %% Storage Tier
    subgraph DBTier ["Database & Storage (Week 1 / 2)"]
        DB[("MongoDB Atlas Database<br/>(Indexed Collections & Users)")]:::db
    end

    %% External Tier
    subgraph ExtTier ["External Services & Infrastructure (Week 4)"]
        LLM["Groq LLM API (Free)"]:::ext
        Tools["Tools: Weather & Maps APIs"]:::ext
        AWSSecrets["AWS Secrets Manager / KMS"]:::ext
        CloudWatch["Amazon CloudWatch Logging"]:::ext
    end

    %% Connect UI controls
    FE --> Val --> Queries
    Queries --> AuthFE
    ChartsFE --> FE

    %% Core Data flow
    Queries -->|JSON REST Requests| API
    Coord -->|Inference Query| LLM
    LLM -->|Perform Tool Calling| Tools
    Coord -->|Store Completed Trip Profile| DB
    AIPlanner -->|Read Secrets| AWSSecrets
    API -.->|Metrics & Diagnostics| CloudWatch
    DB -->|Return Results| API
    API -->|Send JSON Payload Response| Queries
```