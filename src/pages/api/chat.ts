import type { APIRoute } from 'astro';
import OpenAI from 'openai';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { Liquid } from 'liquidjs';
import fs from 'fs';
import path from 'path';

export const prerender = false;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize AJV with formats
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Load and compile the schema
const schemaPath = path.join(process.cwd(), 'src/schemas/mortigen_render_context.schema.json');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
const schema = JSON.parse(schemaContent);
const validate = ajv.compile(schema);

// Initialize Liquid template engine
const engine = new Liquid({
  root: path.join(process.cwd(), 'src/templates'),
  extname: '.liquid'
});

export const POST: APIRoute = async ({ request }) => {
  console.log('API endpoint called');
  
  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    console.error('OpenAI API key not found');
    return new Response(`
      <div class="error-message">
        <h3>⚠️ Configuration Error</h3>
        <p>OpenAI API key is not configured. Please add your API key to the environment variables.</p>
      </div>
    `, {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  try {
    console.log('Reading request body...');
    
    // Read request body as text first
    const bodyText = await request.text();
    console.log('Raw request body:', bodyText);
    
    // Check if body is empty
    if (!bodyText || bodyText.trim() === '') {
      console.error('Empty request body received');
      return new Response(`
        <div class="error-message">
          <h3>⚠️ Invalid Request</h3>
          <p>Request body is empty. Please provide consultation details.</p>
        </div>
      `, {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Parse JSON safely
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Failed to parse body:', bodyText);
      return new Response(`
        <div class="error-message">
          <h3>⚠️ Invalid JSON</h3>
          <p>Request body contains invalid JSON format.</p>
        </div>
      `, {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    const { prompt } = body;
    console.log('Extracted prompt:', prompt);

    if (!prompt) {
      return new Response(`
        <div class="error-message">
          <h3>⚠️ Missing Prompt</h3>
          <p>No consultation details provided.</p>
        </div>
      `, {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    console.log('Making OpenAI API call...');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Consultologist, an AI assistant that helps physicians create consultation notes. 

Your task is to analyze the provided consultation details and generate a structured JSON response that conforms to the mortigen_render_context schema.

The JSON must include:
- patient information (name, age, sex, pronouns)
- staging information (stage_group, tnm classification)
- pathology details (histology, grade, tumor size, nodes)
- receptor status (ER, PR, HER2)
- treatment plan (endocrine therapy, radiation, chemotherapy recommendations)

Always respond with valid JSON that matches the schema exactly. Include realistic medical data based on the consultation details provided.

Example structure:
{
  "front_matter": {
    "patient": {
      "name": "Patient Name",
      "age_years": 65,
      "sex": "female",
      "pronoun": {
        "nom": "she",
        "gen": "her", 
        "obj": "her",
        "refl": "herself"
      }
    },
    "staging": {
      "stage_group": "Stage IIA",
      "tnm": {
        "prefix": "p",
        "T": "T2",
        "N": "N0",
        "M": "M0"
      }
    },
    "pathology": {
      "histology": "invasive ductal carcinoma",
      "grade": "2",
      "tumor_size_cm": 2.1,
      "nodes_examined": 3,
      "nodes_positive": 0
    },
    "receptors": {
      "ER": "8/8",
      "PR": "7/8", 
      "her2": {
        "raw_text": "HER2 negative by IHC",
        "label": "HER2-negative",
        "detail": "IHC 1+"
      }
    },
    "plan_structured": {
      "endocrine": {
        "ordered": true,
        "agent": "letrozole"
      },
      "radiation_referred": true,
      "chemotherapy": {
        "recommended": false,
        "risk_basis": "low_oncotype"
      }
    }
  },
  "content": {
    "reason": "Consultation for newly diagnosed breast cancer",
    "hpi": "Patient presents with...",
    "pmh": "Past medical history includes...",
    "social": "Social history...",
    "family": "Family history..."
  },
  "extras": {
    "side": "right"
  },
  "flags": {
    "exam_present": true
  }
}`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 4096,
      temperature: 0.7,
    });

    console.log('OpenAI API call successful');
    const aiResponse = completion.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }

    console.log('AI Response received:', aiResponse.substring(0, 200) + '...');

    // Parse the AI response as JSON
    let renderContext;
    try {
      renderContext = JSON.parse(aiResponse);
      console.log('Successfully parsed AI response as JSON');
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('AI Response:', aiResponse);
      throw new Error('AI response is not valid JSON');
    }

    // Validate against schema
    console.log('Validating against schema...');
    const isValid = validate(renderContext);
    
    if (!isValid) {
      console.error('Schema validation failed:', validate.errors);
      throw new Error(`Schema validation failed: ${JSON.stringify(validate.errors)}`);
    }

    console.log('Schema validation successful');

    // Render the template
    console.log('Rendering template...');
    const html = await engine.renderFile('consult_response', renderContext);
    console.log('Template rendered successfully');

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('API Error details:', {
      message: error.message,
      stack: error.stack
    });
    
    return new Response(`
      <div class="error-message">
        <h3>⚠️ Error</h3>
        <p>Sorry, there was an error processing your request. Please check your API key configuration and try again.</p>
        <details style="margin-top: 1rem;">
          <summary style="cursor: pointer; color: #666;">Click for technical details</summary>
          <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; margin-top: 0.5rem; font-size: 0.8rem; overflow-x: auto;">${error.message}</pre>
        </details>
      </div>
    `, {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
};