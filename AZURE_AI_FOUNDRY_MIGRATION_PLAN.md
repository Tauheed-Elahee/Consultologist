# Azure AI Foundry Migration Plan

## Overview

This document outlines the migration strategy from OpenAI API key-based authentication to Azure AI Foundry with Managed Identity authentication. This migration enhances security by eliminating API key management and provides enterprise-grade identity-based authentication.

## Understanding the Authentication Approaches

### Managed Identity vs Service Principal

- **Managed Identity**: Azure automatically manages the credentials for you. No secrets to store or rotate. Perfect for Azure-hosted services like Static Web Apps. **This is what we'll use.**
- **Service Principal**: Manual credential management with client ID/secret that you need to secure and rotate. More work, less secure for this use case.

### Development vs Production Authentication

- **Local Development**: Uses Azure CLI credentials (run `az login` on your machine)
- **Production**: Uses Managed Identity (Azure handles it automatically)
- **Key Benefit**: The Azure SDK's `DefaultAzureCredential` supports both automatically - it tries Azure CLI first (for local), then Managed Identity (for production)

### Marketing Demo Site vs Main Application

- **Marketing Demo Site** (this migration): Public demo using Managed Identity for backend service authentication
- **Main Application** (future): User authentication via Microsoft Entra ID (formerly Azure AD) for work account login, while backend still uses Managed Identity for service-to-service calls

---

## Migration Steps

### 1. Azure AI Foundry Resource Setup

**Actions Required:**
- Create Azure AI Foundry Hub in Azure portal
- Create Azure AI Foundry Project within the hub
- Deploy GPT-3.5-turbo model in Azure OpenAI Service through AI Foundry
- Note the deployment name (can be different from "gpt-3.5-turbo")
- Retrieve the project endpoint URL from AI Foundry portal
- Enable Managed Identity on your Azure Static Web App
- Assign "Cognitive Services User" role to the Static Web App's Managed Identity

**Resources to Configure:**
```
Azure AI Foundry Hub
└── Azure AI Foundry Project
    └── Azure OpenAI Service
        └── GPT-3.5-turbo Deployment
```

**Required Information to Collect:**
- Project Endpoint URL (format: `https://<project-name>.<region>.api.cognitive.microsoft.com`)
- Model Deployment Name (e.g., `gpt-35-turbo-deployment`)
- Azure OpenAI API Version (e.g., `2024-08-01-preview`)

---

### 2. Update Package Dependencies

**Changes to `package.json`:**

```json
{
  "dependencies": {
    "@azure/identity": "^4.0.0",
    "openai": "^5.23.1",
    // ... existing dependencies
  }
}
```

**Changes to `api/package.json`:**

```json
{
  "dependencies": {
    "@azure/identity": "^4.0.0",
    "openai": "^4.0.0",
    // ... existing dependencies
  }
}
```

**Installation Command:**
```bash
npm install @azure/identity
```

---

### 3. Environment Configuration Changes

**Remove:**
- `OPENAI_API_KEY`

**Add:**
- `AZURE_OPENAI_ENDPOINT` - Your AI Foundry project endpoint
- `AZURE_OPENAI_DEPLOYMENT_NAME` - Your model deployment name
- `AZURE_OPENAI_API_VERSION` - API version (e.g., "2024-08-01-preview")

**Updated `.env` file:**
```env
# Azure AI Foundry Configuration
AZURE_OPENAI_ENDPOINT=https://<your-project>.<region>.api.cognitive.microsoft.com
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-35-turbo-deployment
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Existing Supabase Configuration
VITE_SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Update `src/env.d.ts`:**
```typescript
declare namespace App {
  interface Locals {
    runtime?: {
      env: {
        AZURE_OPENAI_ENDPOINT?: string;
        AZURE_OPENAI_DEPLOYMENT_NAME?: string;
        AZURE_OPENAI_API_VERSION?: string;
      };
    };
  }
}
```

**Azure Static Web Apps Configuration:**
In Azure Portal → Static Web Apps → Configuration → Application Settings, add:
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_DEPLOYMENT_NAME`
- `AZURE_OPENAI_API_VERSION`

---

### 4. Authentication Implementation

**Code Changes Overview:**

**Before (API Key):**
```javascript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

**After (Managed Identity):**
```javascript
import { DefaultAzureCredential } from '@azure/identity';
import { AzureOpenAI } from 'openai';

const credential = new DefaultAzureCredential();
const scope = "https://cognitiveservices.azure.com/.default";

const openai = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  azureADTokenProvider: async () => {
    const token = await credential.getToken(scope);
    return token.token;
  },
});

// When making API calls, use deployment name instead of model name
const completion = await openai.chat.completions.create({
  model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  messages: [...],
  // ... other parameters
});
```

**Files to Modify:**
1. `api/chat/index.js` - Azure Functions API endpoint
2. `src/pages/api/chat.ts` - Astro API route

---

### 5. Azure Static Web App Managed Identity Configuration

**Steps in Azure Portal:**

1. **Enable Managed Identity:**
   - Navigate to your Static Web App resource
   - Go to Settings → Identity
   - Under "System assigned" tab, toggle Status to "On"
   - Click "Save"
   - Copy the Object (principal) ID

2. **Assign Role to Managed Identity:**
   - Navigate to your Azure AI Foundry resource
   - Go to Access control (IAM)
   - Click "Add" → "Add role assignment"
   - Select "Cognitive Services User" role
   - Click "Next"
   - Select "Managed identity"
   - Click "Select members"
   - Choose "Static Web App" and select your app
   - Click "Review + assign"

3. **Verify Permissions:**
   - Ensure the Managed Identity has access to the specific Azure OpenAI deployment
   - Test from Azure Cloud Shell if needed

---

### 6. Local Development Setup with Azure CLI

**Developer Setup Instructions:**

1. **Install Azure CLI:**
   ```bash
   # macOS
   brew install azure-cli

   # Windows
   # Download from https://aka.ms/installazurecliwindows

   # Linux
   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
   ```

2. **Login to Azure:**
   ```bash
   az login
   ```

3. **Verify Authentication:**
   ```bash
   az account show
   ```

4. **Assign Developer Role:**
   - Your Azure account needs "Cognitive Services User" role on the AI Foundry project
   - Request from Azure administrator if you don't have it

5. **Run Development Server:**
   ```bash
   npm run dev
   ```

**How DefaultAzureCredential Works:**
- Automatically tries multiple authentication methods in order
- For local development: Uses Azure CLI credentials
- For production: Uses Managed Identity
- No code changes needed between environments

**Troubleshooting Common Issues:**

| Issue | Solution |
|-------|----------|
| "Authentication failed" locally | Run `az login` and ensure you're logged in |
| "Permission denied" | Request "Cognitive Services User" role assignment |
| "Deployment not found" | Verify `AZURE_OPENAI_DEPLOYMENT_NAME` matches actual deployment |
| Works locally but not in production | Check Managed Identity is enabled and role is assigned |

---

### 7. Update API Code for Azure OpenAI

**Key Changes:**

1. **Import Azure Identity:**
   ```javascript
   import { DefaultAzureCredential } from '@azure/identity';
   ```

2. **Initialize Credential Provider:**
   ```javascript
   const credential = new DefaultAzureCredential();
   const scope = "https://cognitiveservices.azure.com/.default";
   ```

3. **Configure Azure OpenAI Client:**
   ```javascript
   const openai = new AzureOpenAI({
     endpoint: process.env.AZURE_OPENAI_ENDPOINT,
     apiVersion: process.env.AZURE_OPENAI_API_VERSION,
     azureADTokenProvider: async () => {
       const token = await credential.getToken(scope);
       return token.token;
     },
   });
   ```

4. **Update Model Parameter:**
   ```javascript
   // Before
   model: "gpt-3.5-turbo"

   // After
   model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME
   ```

**What Stays the Same:**
- Prompt engineering and system context
- Schema validation with AJV
- Liquid template rendering
- Request/response handling
- Error message structure

---

### 8. Error Handling and User Experience

**Enhanced Error Messages:**

```javascript
// Authentication Error
if (!process.env.AZURE_OPENAI_ENDPOINT) {
  return {
    status: 500,
    body: `
      <div class="error-message">
        <h3>⚠️ Configuration Error</h3>
        <p>Azure OpenAI endpoint is not configured. Please configure Azure AI Foundry settings.</p>
      </div>
    `
  };
}

// Credential Error
try {
  const token = await credential.getToken(scope);
} catch (error) {
  console.error('Azure authentication failed:', error);
  return {
    status: 500,
    body: `
      <div class="error-message">
        <h3>⚠️ Authentication Error</h3>
        <p>Unable to authenticate with Azure AI services. Please check Managed Identity configuration.</p>
      </div>
    `
  };
}

// Deployment Not Found Error
try {
  const completion = await openai.chat.completions.create({...});
} catch (error) {
  if (error.code === 'DeploymentNotFound') {
    console.error('Deployment name mismatch:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);
    return {
      status: 500,
      body: `
        <div class="error-message">
          <h3>⚠️ Configuration Error</h3>
          <p>Azure OpenAI deployment not found. Please verify deployment name.</p>
        </div>
      `
    };
  }
  throw error;
}
```

**Logging Enhancements:**
```javascript
console.log('Authentication method:', {
  isLocalDev: !!process.env.AZURE_CLI_CONTEXT,
  isManagedIdentity: !!process.env.IDENTITY_ENDPOINT,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME
});
```

---

### 9. Supabase Integration for Marketing Site

**Database Schema for Demo Analytics:**

```sql
-- Create table for demo usage tracking
CREATE TABLE demo_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT now(),
  prompt_length INTEGER,
  response_success BOOLEAN,
  error_message TEXT,
  processing_time_ms INTEGER,
  client_ip TEXT,
  user_agent TEXT
);

ALTER TABLE demo_usage ENABLE ROW LEVEL SECURITY;

-- Public can insert (for demo tracking)
CREATE POLICY "Anyone can log demo usage"
  ON demo_usage FOR INSERT
  TO anon
  WITH CHECK (true);

-- Only authenticated admins can read
CREATE POLICY "Admins can view analytics"
  ON demo_usage FOR SELECT
  TO authenticated
  USING (true);
```

**Usage Tracking Implementation:**

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Track demo usage
await supabase.from('demo_usage').insert({
  prompt_length: prompt.length,
  response_success: true,
  processing_time_ms: processingTime,
  client_ip: request.headers.get('x-forwarded-for'),
  user_agent: request.headers.get('user-agent')
});
```

**Analytics Dashboard (Future Enhancement):**
- Total demo requests per day/week/month
- Success rate and common errors
- Average response time
- Popular consultation types
- Geographic distribution of demo users

---

### 10. Future-Proofing for Main Application

**Separation of Concerns:**

| Component | Marketing Demo Site | Main Application |
|-----------|---------------------|------------------|
| User Authentication | None (public demo) | Microsoft Entra ID (Work accounts) |
| Backend Service Auth | Managed Identity | Managed Identity |
| Database | Supabase (analytics only) | Supabase (user data, templates) |
| Authorization | Public access | Role-based access control |
| Multi-tenancy | Single-tenant | Multi-tenant with data isolation |

**Database Schema Planning for Main App:**

```sql
-- Users table (synced with Microsoft Entra ID)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entra_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ
);

-- Organizations (for multi-tenant support)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User templates
CREATE TABLE consultation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  template_content JSONB NOT NULL,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies for data isolation
ALTER TABLE consultation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and shared templates"
  ON consultation_templates FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (is_shared = true AND organization_id = (
      SELECT organization_id FROM users WHERE id = auth.uid()
    ))
  );
```

**Microsoft Entra ID Integration (Future):**
- Use `@azure/msal-node` for backend authentication
- Configure App Registration in Azure AD
- Implement OAuth 2.0 authorization code flow
- Store user tokens securely in session
- Sync user profile data to Supabase

---

### 11. Testing Strategy for Dev/Prod

**Environment Setup:**

```
Development Environment:
├── Azure AI Foundry Project: dev-consultologist-ai
├── Static Web App: dev-consultologist-web
├── Authentication: Azure CLI (developer accounts)
└── Supabase: Development project

Staging Environment:
├── Azure AI Foundry Project: staging-consultologist-ai
├── Static Web App: staging-consultologist-web (deployment slot)
├── Authentication: Managed Identity
└── Supabase: Staging project

Production Environment:
├── Azure AI Foundry Project: prod-consultologist-ai
├── Static Web App: prod-consultologist-web
├── Authentication: Managed Identity
└── Supabase: Production project
```

**Testing Checklist:**

- [ ] **Local Development Testing**
  - [ ] Run `az login` and verify authentication
  - [ ] Start dev server and test API endpoints
  - [ ] Verify DefaultAzureCredential uses Azure CLI
  - [ ] Test error handling for auth failures
  - [ ] Confirm schema validation still works

- [ ] **Staging Environment Testing**
  - [ ] Deploy to staging slot
  - [ ] Enable Managed Identity on staging
  - [ ] Assign "Cognitive Services User" role
  - [ ] Test API endpoints in staging
  - [ ] Verify Managed Identity authentication
  - [ ] Load test with multiple concurrent requests
  - [ ] Test error scenarios (wrong deployment name, etc.)

- [ ] **Production Deployment**
  - [ ] Review all environment variables
  - [ ] Verify Managed Identity configuration
  - [ ] Deploy to production
  - [ ] Smoke test all endpoints
  - [ ] Monitor logs for authentication issues
  - [ ] Verify analytics tracking in Supabase

**Environment Variable Management:**

```bash
# Development (.env file)
AZURE_OPENAI_ENDPOINT=https://dev-project.region.api.cognitive.microsoft.com
AZURE_OPENAI_DEPLOYMENT_NAME=dev-gpt-35-turbo
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Staging (Azure Portal → Static Web Apps → Configuration)
AZURE_OPENAI_ENDPOINT=https://staging-project.region.api.cognitive.microsoft.com
AZURE_OPENAI_DEPLOYMENT_NAME=staging-gpt-35-turbo
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Production (Azure Portal → Static Web Apps → Configuration)
AZURE_OPENAI_ENDPOINT=https://prod-project.region.api.cognitive.microsoft.com
AZURE_OPENAI_DEPLOYMENT_NAME=prod-gpt-35-turbo
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

**Deployment Process:**

1. **Update Code:**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Test Locally:**
   ```bash
   npm run build
   npm run preview
   ```

3. **Deploy to Staging:**
   ```bash
   git push origin main
   # Triggers automatic deployment to staging slot
   ```

4. **Test Staging:**
   ```bash
   # Verify staging URL
   curl https://staging-consultologist.azurestaticapps.net/api/chat
   ```

5. **Promote to Production:**
   - In Azure Portal, swap staging and production slots
   - Monitor for issues
   - Rollback if needed

---

### 12. Documentation and Architecture

**Architecture Diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│                      User's Browser                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS Request
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Azure Static Web Apps                           │
│  ┌────────────────────────────────────────────────────┐    │
│  │           Astro Frontend (Static)                   │    │
│  └────────────────────┬───────────────────────────────┘    │
│                       │                                      │
│                       │ Calls API                            │
│                       ▼                                      │
│  ┌────────────────────────────────────────────────────┐    │
│  │         API Routes (Azure Functions)                │    │
│  │  - /api/chat.ts (Astro API)                        │    │
│  │  - /api/chat/index.js (Azure Function)             │    │
│  └────────────────────┬───────────────────────────────┘    │
│                       │                                      │
│  ┌────────────────────┴───────────────────────────────┐    │
│  │         Managed Identity (System-assigned)          │    │
│  │  - Automatically managed by Azure                   │    │
│  │  - No secrets to store or rotate                    │    │
│  └────────────────────┬───────────────────────────────┘    │
└───────────────────────┼──────────────────────────────────────┘
                        │
                        │ Token Request
                        │ (DefaultAzureCredential)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Azure AI Foundry                                │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Azure OpenAI Service                   │    │
│  │  - GPT-3.5-turbo Deployment                        │    │
│  │  - Validates Managed Identity token                │    │
│  │  - Returns AI-generated response                   │    │
│  └────────────────────┬───────────────────────────────┘    │
└───────────────────────┼──────────────────────────────────────┘
                        │
                        │ Response
                        ▼
┌─────────────────────────────────────────────────────────────┐
│           Supabase (Analytics & Future User Data)            │
│  - Track demo usage                                          │
│  - Store user templates (future)                             │
│  - Multi-tenant data isolation (future)                      │
└─────────────────────────────────────────────────────────────┘
```

**Authentication Flow:**

```
Local Development:
┌──────────────┐    az login    ┌──────────────┐
│  Developer   │───────────────▶│  Azure CLI   │
└──────────────┘                └──────┬───────┘
                                       │
                                       │ Credentials
                                       ▼
┌──────────────────────────────────────────────────┐
│     DefaultAzureCredential                       │
│  1. Try Azure CLI credentials ✓                  │
│  2. Try Managed Identity (skip, not available)   │
└──────────────────────────────────────────────────┘

Production:
┌──────────────┐                ┌──────────────┐
│  Static Web  │   Automatic    │   Managed    │
│     App      │───────────────▶│   Identity   │
└──────────────┘                └──────┬───────┘
                                       │
                                       │ System-assigned token
                                       ▼
┌──────────────────────────────────────────────────┐
│     DefaultAzureCredential                       │
│  1. Try Azure CLI (skip, not available)          │
│  2. Try Managed Identity ✓                       │
└──────────────────────────────────────────────────┘
```

**README Section:**

```markdown
## Azure AI Foundry Setup

### Prerequisites
- Azure subscription
- Azure CLI installed
- Node.js 20+
- Access to Azure AI Foundry

### Local Development Setup

1. **Install Azure CLI:**
   ```bash
   # macOS
   brew install azure-cli

   # Windows
   winget install Microsoft.AzureCLI
   ```

2. **Login to Azure:**
   ```bash
   az login
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your Azure AI Foundry settings
   ```

4. **Install Dependencies:**
   ```bash
   npm install
   ```

5. **Run Development Server:**
   ```bash
   npm run dev
   ```

### Production Deployment

1. **Create Azure Resources:**
   - Azure AI Foundry Hub and Project
   - Azure OpenAI Service deployment
   - Azure Static Web App

2. **Enable Managed Identity:**
   - Navigate to Static Web App → Identity
   - Enable System-assigned identity
   - Copy Object ID

3. **Assign Permissions:**
   - Navigate to Azure AI Foundry → Access control (IAM)
   - Add role assignment: "Cognitive Services User"
   - Assign to Static Web App's Managed Identity

4. **Configure Application Settings:**
   - Add environment variables in Azure Portal
   - Deploy application

### Troubleshooting

**Authentication Failed Locally:**
- Ensure you're logged in: `az login`
- Verify account has "Cognitive Services User" role
- Check `.env` file has correct endpoint

**Works Locally But Not in Production:**
- Verify Managed Identity is enabled
- Check role assignment on AI Foundry resource
- Confirm environment variables in Azure Portal

**Deployment Not Found:**
- Verify `AZURE_OPENAI_DEPLOYMENT_NAME` matches actual deployment name
- Check deployment is in "Succeeded" state in Azure Portal
```

---

## Summary

### Key Benefits

1. **Enhanced Security:**
   - Eliminates API key storage and rotation
   - Uses Azure-managed identities
   - Better audit trails and compliance

2. **Simplified Development:**
   - Same code works in dev and production
   - DefaultAzureCredential handles authentication automatically
   - No secret management needed

3. **Cost Visibility:**
   - Usage tied to specific Azure resources
   - Better tracking for billing and budgeting
   - Separate dev/staging/prod costs

4. **Scalability:**
   - Foundation for multi-user main application
   - Ready for Microsoft Entra ID integration
   - Supports enterprise authentication patterns

5. **Future-Ready:**
   - Prepared for user authentication in main app
   - Database schema designed for multi-tenancy
   - Separation of concerns for different environments

### Migration Effort Estimate

| Task | Estimated Time |
|------|----------------|
| Azure resource setup | 2-3 hours |
| Code changes | 3-4 hours |
| Local testing | 1-2 hours |
| Staging deployment and testing | 2-3 hours |
| Production deployment | 1-2 hours |
| Documentation | 2-3 hours |
| **Total** | **11-17 hours** |

### Post-Migration Checklist

- [ ] All API endpoints use Managed Identity
- [ ] Local development works with Azure CLI
- [ ] Production uses Managed Identity successfully
- [ ] Error handling covers Azure-specific scenarios
- [ ] Environment variables documented
- [ ] Team members can authenticate locally
- [ ] Supabase analytics tracking implemented
- [ ] Cost monitoring configured
- [ ] Documentation updated
- [ ] Rollback plan tested

---

## Next Steps

1. Review this plan with stakeholders
2. Set up Azure AI Foundry resources
3. Begin code implementation
4. Test in local environment
5. Deploy to staging
6. Monitor and validate
7. Deploy to production
8. Plan for main application features

---

## Additional Resources

- [Azure AI Foundry Documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/)
- [DefaultAzureCredential](https://learn.microsoft.com/en-us/azure/developer/javascript/sdk/authentication/overview)
- [Azure Static Web Apps Managed Identity](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization)
- [Azure OpenAI Service](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Supabase Documentation](https://supabase.com/docs)

---

*Last Updated: 2025-10-23*
*Document Version: 1.0*
