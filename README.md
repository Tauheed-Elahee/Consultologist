# Consultologist

An AI-powered breast cancer consultation note generator for oncologists. Consultologist uses advanced language models to transform consultation details into structured, validated medical documentation.

## Overview

Consultologist is a specialized web application built with Astro that helps oncologists create standardized consultation notes for breast cancer patients. The system uses OpenAI's GPT models to process consultation inputs and generate structured medical documentation that adheres to strict JSON schemas for consistency and accuracy.

## Features

- **AI-Powered Note Generation**: Converts natural language consultation details into structured medical notes
- **Schema Validation**: Ensures all generated data conforms to strict medical documentation standards
- **Liquid Template Rendering**: Professional HTML output using customizable Liquid templates
- **TNM Staging Support**: Comprehensive breast cancer staging with pathologic and clinical classifications
- **Receptor Status Tracking**: Detailed ER/PR/HER2 receptor documentation
- **Treatment Planning**: Structured tracking of endocrine therapy, chemotherapy, and radiation plans
- **Oncotype DX Integration**: Support for genomic testing scores and risk assessments
- **Cloudflare Deployment**: Server-side rendering optimized for edge deployment

## Technology Stack

- **Framework**: Astro 5.7.0 with SSR
- **Deployment**: Cloudflare Workers with edge runtime
- **AI/ML**: OpenAI GPT-3.5-turbo with structured JSON outputs
- **Templating**: LiquidJS for medical note rendering
- **Validation**: AJV (Another JSON Validator) with format support
- **Language**: TypeScript
- **Build Tools**: Node.js, npm

## Project Structure

```
consultologist/
├── src/
│   ├── components/       # Astro UI components
│   │   ├── Header.astro
│   │   ├── Hero.astro
│   │   ├── About.astro
│   │   ├── Services.astro
│   │   ├── Contact.astro
│   │   └── Footer.astro
│   ├── pages/
│   │   ├── index.astro   # Landing page
│   │   ├── demo.astro    # Interactive demo
│   │   └── api/
│   │       ├── chat.ts   # Main consultation processing API
│   │       └── api-test.ts
│   ├── schemas/
│   │   ├── mortigen_render_context.schema.json  # JSON schema definition
│   │   └── compiled-validator.js                 # Pre-compiled AJV validator
│   └── templates/
│       └── consult_response.liquid               # Medical note template
├── scripts/
│   └── compile-schema.js    # Schema compilation script
├── public/                  # Static assets
└── astro.config.mjs        # Astro configuration

```

## Key Components

### API Endpoint (`/api/chat`)

The core API endpoint that:
1. Receives consultation details as a prompt
2. Sends structured instructions to OpenAI GPT-3.5-turbo
3. Validates the AI response against the medical schema
4. Renders the validated data using Liquid templates
5. Returns formatted HTML consultation notes

### JSON Schema

The `mortigen_render_context.schema.json` defines the structure for:
- Patient demographics (name, age, sex, pronouns)
- Encounter information
- Diagnosis tracking
- TNM staging (with patterns like `T1N0M0`)
- Pathology details (histology, grade, tumor size, nodes)
- Receptor status (ER, PR, HER2 with specific scoring patterns)
- Oncotype DX scores and risk percentages
- Structured treatment plans
- Medications and allergies

### Validation System

Pre-compiled AJV validators ensure:
- All required fields are present
- Data types match specifications
- Enum values are within allowed sets
- Patterns match medical conventions (e.g., TNM staging format)
- Referential integrity between related fields

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file with required environment variables:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

For Cloudflare deployment, configure the API key as a secret in your Cloudflare dashboard.

## Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:4321`

## Building

Compile the schema and build the project:

```bash
npm run build
```

The prebuild script automatically compiles the JSON schema into an optimized validator before building.

## Deployment

The project is configured for Cloudflare Pages deployment with:
- Server-side rendering enabled
- Platform proxy for local development
- Edge runtime compatibility

Deploy to Cloudflare:

```bash
npm run build
# Deploy the dist/ directory to Cloudflare Pages
```

## Medical Schema Details

### Staging Format

TNM staging follows AJCC/UICC guidelines:
- **Prefix**: `p` (pathologic), `c` (clinical), `yp` (post-neoadjuvant pathologic), `yc` (post-neoadjuvant clinical), `x` (cannot be assessed)
- **T (Tumor)**: `Tis`, `T1`, `T1a`, `T1b`, `T1c`, `T2`, `T3`, `T4a`, `T4b`, `T4c`, `T4d`
- **N (Nodes)**: `N0`, `N1`, `N1a`, `N1b`, `N1c`, `N2a`, `N2b`, `N3a`, `N3b`, `N3c`
- **M (Metastasis)**: `M0`, `M1`, `MX`

### Receptor Scoring

- **ER/PR**: Scored as fractions (0/8 through 8/8)
- **HER2**: Includes IHC scores (0, 1+, 2+, 3+) and FISH results (positive/negative/equivocal)

### Treatment Plans

Structured tracking includes:
- **Endocrine therapy**: Letrozole, Tamoxifen, or other agents
- **Chemotherapy regimens**: BRAJACTG, BRAJDC, AC_TH, TCH
- **Radiation**: Referral tracking

## API Usage Example

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Patient is a 55-year-old female with newly diagnosed Stage IIA breast cancer...'
  })
});

const consultationHTML = await response.text();
```

## License

See `License.md` for details.

## Contributing

This is a specialized medical application. Contributions should maintain strict adherence to medical documentation standards and schema validation requirements.

## Security Considerations

- OpenAI API keys must be secured and never committed to version control
- Schema validation is mandatory to prevent malformed medical data
- All AI-generated content is validated before rendering
- Server-side rendering protects sensitive configuration

## Support

For issues, questions, or feature requests, please refer to the project repository or contact the development team.
