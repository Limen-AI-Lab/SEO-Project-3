# TaxFlow Agency Portal

<div align="center">
  <h3>AI-Powered Content Creation Platform for SEO Agencies</h3>
  <p>Streamline your content workflow from ideation to client approval</p>
</div>

## Overview

TaxFlow Agency Portal is a comprehensive content management system designed for SEO agencies to create, manage, and collaborate on blog content with their clients. The platform integrates AI-powered content generation (via Google Gemini) with a structured workflow that guides articles through titles, outlines, drafts, and client review stages.

## Features

### Core Functionality
- **Client Management**: Create and manage client profiles with default tone of voice and content rules
- **Campaign Management**: Organize content creation by campaigns with strategy goals and target audiences
- **Article Workflow**: Structured workflow from title generation → outline → draft → client review
- **AI Content Generation**: 
  - Generate SEO-optimized blog titles
  - Create structured outlines
  - Generate full blog drafts
  - Refine content based on feedback
  - SEO analysis and keyword suggestions
- **Client Collaboration**: Integrated review system where clients can approve or request revisions
- **Status Tracking**: Real-time status updates throughout the article lifecycle

### Workflow States
- `NEEDS_TITLES` - Agency generates article titles
- `AWAITING_REVIEW_TITLES` - Client reviews and selects a title
- `TITLES_APPROVED` - Agency creates outline
- `AWAITING_REVIEW_OUTLINE` - Client reviews outline
- `OUTLINE_APPROVED` - Agency creates draft
- `AWAITING_REVIEW_DRAFT` - Client reviews draft
- `DRAFT_APPROVED` - Article completed
- `NEEDS_REVISION` - Client requests changes

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 6
- **UI Components**: Lucide React (icons)
- **Database**: Supabase (PostgreSQL)
- **AI Integration**: Google Gemini API (`@google/genai`)
- **Charts**: Recharts, D3.js
- **Styling**: Tailwind CSS (via inline classes)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher recommended)
- **npm** or **yarn** package manager
- **Supabase Account** (free tier works)
- **Google Gemini API Key** (get from [Google AI Studio](https://makersuite.google.com/app/apikey))

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd SEO-2-version-main
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```env
API_KEY=your_gemini_api_key_here
```

**Note**: The Gemini API key is used by `services/geminiService.ts` for AI content generation.

### 4. Configure Supabase

#### Step 1: Create Supabase Project
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project
3. Note your Project URL and Anon Key from **Project Settings > API**

#### Step 2: Update Supabase Client Configuration

Edit `services/supabaseClient.js`:

```javascript
const supabaseUrl = 'YOUR_SUPABASE_PROJECT_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';
```

#### Step 3: Set Up Database Schema

1. Open Supabase Dashboard > SQL Editor
2. Run `supabase_setup.sql` to create initial tables:
   ```sql
   -- This creates: clients, campaigns, articles tables
   ```

3. Run `supabase_schema_update.sql` to add additional fields and constraints:
   ```sql
   -- This adds: last_updated, selected_title, status constraints, indexes
   ```

**Important**: Run `supabase_setup.sql` first, then `supabase_schema_update.sql`.

### 5. Run the Application

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the port shown in terminal).

## Configuration

### Supabase Configuration

The Supabase client is configured in `services/supabaseClient.js`. You need to:

1. Replace `YOUR_SUPABASE_PROJECT_URL` with your Supabase project URL
2. Replace `YOUR_SUPABASE_ANON_KEY` with your Supabase anon/public key

**Where to find these values:**
- Supabase Dashboard > Project Settings > API
- Project URL: Under "Project URL"
- Anon Key: Under "Project API keys" > "anon" / "public"

### Gemini API Configuration

The Gemini API key is read from environment variables:

- **Development**: Set `API_KEY` in `.env.local`
- **Production**: Set `API_KEY` in your hosting platform's environment variables

The service automatically uses `process.env.API_KEY` (see `services/geminiService.ts`).

### Database Schema

#### Tables

**clients**
- `id` (UUID, Primary Key)
- `name` (TEXT, Required)
- `tone_of_voice` (TEXT)
- `strict_rules` (TEXT)
- `industry`, `website`, `contact_person`, `email`, `phone` (TEXT, Optional)
- `created_at` (TIMESTAMP)

**campaigns**
- `id` (UUID, Primary Key)
- `client_id` (UUID, Foreign Key → clients.id)
- `name` (TEXT, Required)
- `strategy_goals` (TEXT)
- `target_audience` (TEXT)
- `keywords` (TEXT[])
- `status` (TEXT: 'ACTIVE' | 'ARCHIVED')
- `created_at` (TIMESTAMP)

**articles**
- `id` (UUID, Primary Key)
- `campaign_id` (UUID, Foreign Key → campaigns.id)
- `title` (TEXT, Required)
- `status` (TEXT, Required - see workflow states above)
- `proposed_titles` (TEXT[])
- `selected_title` (TEXT)
- `outline_content` (TEXT)
- `draft_content` (TEXT)
- `client_comments` (JSONB)
- `created_at` (TIMESTAMP)
- `last_updated` (TIMESTAMP, Auto-updated)

#### Relationships

```
clients (1) ──< (many) campaigns (1) ──< (many) articles
```

## Usage

### Creating a Client

1. Navigate to **Clients** in the sidebar
2. Click **"Add New Client"**
3. Fill in:
   - Client name (required)
   - Tone of voice (optional, used as default for AI generation)
   - Strict rules (optional, content guidelines)
   - Additional contact information
4. Click **"Save Client"**

### Creating a Campaign

1. Go to **Dashboard**
2. Click **"Start Campaign"**
3. Select a client from the dropdown
4. Enter campaign name and strategy goals
5. Click **"Create Campaign"**

### Creating an Article

1. Open a campaign from the Dashboard
2. Click **"Create Article"**
3. Enter article topic/title
4. Click **"Create"**

### Article Workflow

#### Stage 1: Generate Titles
1. Click on an article with status "Needs Titles"
2. Click **"Generate Titles"**
3. Review AI-generated titles
4. Click **"Submit to Client"** to send for review

#### Stage 2: Client Reviews Titles
- Article status changes to `AWAITING_REVIEW_TITLES`
- Client selects a title in Client Portal
- Status updates to `TITLES_APPROVED`

#### Stage 3: Create Outline
1. Article status becomes `TITLES_APPROVED`
2. Click **"Generate Outline"**
3. Review and refine outline
4. Click **"Submit to Client"** → Status: `AWAITING_REVIEW_OUTLINE`

#### Stage 4: Client Reviews Outline
- Client approves or requests changes
- If approved: Status → `OUTLINE_APPROVED`
- If rejected: Status → `NEEDS_REVISION` (with comments)

#### Stage 5: Create Draft
1. After outline approval, click **"Generate Draft"**
2. Review and refine content
3. Click **"Submit to Client"** → Status: `AWAITING_REVIEW_DRAFT`

#### Stage 6: Client Reviews Draft
- Client approves or requests changes
- If approved: Status → `DRAFT_APPROVED` (Complete!)
- If rejected: Status → `NEEDS_REVISION`

## Project Structure

```
SEO-2-version-main/
├── components/              # React components
│   ├── Dashboard.tsx       # Main dashboard with campaigns
│   ├── CampaignDetail.tsx  # Campaign view with articles
│   ├── ProjectWorkspace.tsx # Article editing workspace
│   ├── ClientManagement.tsx # Client CRUD interface
│   ├── ClientReviewPage.tsx # Client review interface
│   ├── StageTitles.tsx     # Title generation stage
│   ├── StageOutline.tsx    # Outline generation stage
│   ├── StageDraft.tsx     # Draft generation stage
│   └── StatusBadge.tsx     # Status display component
├── constants/
│   └── status.ts          # Article status constants
├── docs/                   # Documentation
│   ├── integration-guide.md
│   ├── client-portal-setup.md
│   └── interaction-flow.md
├── services/
│   ├── supabaseClient.js  # Supabase client configuration
│   ├── geminiService.ts   # AI content generation service
│   └── store.ts           # Legacy store (deprecated)
├── types.ts               # TypeScript type definitions
├── App.tsx                # Main application component
├── index.tsx              # Application entry point
├── supabase_setup.sql     # Initial database schema
├── supabase_schema_update.sql # Schema updates
└── package.json           # Dependencies and scripts
```

## Integration with Client Portal

This Agency Portal works in conjunction with a separate **Client Portal** application. The two portals share the same Supabase database and use synchronized status constants.

### How It Works

1. **Agency Portal** (this project):
   - Creates clients, campaigns, and articles
   - Generates content using AI
   - Submits content for client review
   - Receives feedback and makes revisions

2. **Client Portal** ([SEO-client-version](https://github.com/lufeizhan-ops/SEO-client-version.git)):
   - Reviews articles at various stages
   - Approves or rejects content
   - Adds comments and feedback
   - Selects titles from proposals

### Shared Resources

- **Database**: Both portals connect to the same Supabase project
- **Status Constants**: Both use identical status values from `constants/status.ts`
- **Data Flow**: Articles move through states that trigger actions in both portals

### Setup for Integration

See detailed integration guide: [`docs/integration-guide.md`](docs/integration-guide.md)

See client portal setup: [`docs/client-portal-setup.md`](docs/client-portal-setup.md)

## Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Code Style

- **TypeScript**: Strict mode enabled
- **Components**: Functional components with hooks
- **State Management**: React useState/useEffect (no Redux)
- **API Calls**: Supabase client for database operations
- **AI Calls**: Gemini service for content generation

### Adding New Features

1. **New Database Fields**: 
   - Add column in Supabase SQL Editor
   - Update TypeScript interfaces in `types.ts`
   - Update component data mapping

2. **New Status States**:
   - Add to `constants/status.ts`
   - Update `StatusBadge.tsx` for display
   - Update workflow logic in components

3. **New AI Features**:
   - Add function to `services/geminiService.ts`
   - Call from component using async/await
   - Handle errors gracefully

## Troubleshooting

### Common Issues

#### 1. "Webpage not loading"
**Cause**: Supabase client configuration incorrect
**Solution**: 
- Check `services/supabaseClient.js` has correct URL and key
- Verify Supabase project is active
- Check browser console for errors

#### 2. "Error creating campaign: client not found"
**Cause**: Client ID mismatch or client doesn't exist
**Solution**:
- Ensure client is created in Clients page first
- Check that client ID is a valid UUID
- Verify database connection

#### 3. "Article stuck in loading state"
**Cause**: Component not fetching from Supabase
**Solution**:
- Check component imports `supabase` from `services/supabaseClient.js`
- Verify database queries use correct table/column names
- Check browser network tab for failed requests

#### 4. "AI generation not working"
**Cause**: Missing or invalid Gemini API key
**Solution**:
- Verify `API_KEY` is set in `.env.local`
- Check API key is valid at Google AI Studio
- Check browser console for API errors

#### 5. "Status not updating correctly"
**Cause**: Status constants mismatch between portals
**Solution**:
- Ensure both portals use same `constants/status.ts` values
- Check database status column matches constants
- Verify status transitions follow workflow rules

### Database Issues

#### Reset Database
```sql
-- WARNING: This deletes all data
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- Then re-run supabase_setup.sql and supabase_schema_update.sql
```

#### Check Status Values
```sql
-- View all unique status values
SELECT DISTINCT status FROM articles;

-- Check for invalid statuses
SELECT * FROM articles 
WHERE status NOT IN (
  'NEEDS_TITLES', 'AWAITING_REVIEW_TITLES', 'TITLES_APPROVED',
  'AWAITING_REVIEW_OUTLINE', 'OUTLINE_APPROVED',
  'AWAITING_REVIEW_DRAFT', 'DRAFT_APPROVED', 'NEEDS_REVISION'
);
```

### Getting Help

1. Check browser console for errors
2. Check Supabase Dashboard > Logs for database errors
3. Review `docs/` folder for detailed guides
4. Verify environment variables are set correctly

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]

## Support

For issues and questions, please [create an issue](link-to-issues) or contact [your support channel].

---

**Built with ❤️ for SEO agencies**
