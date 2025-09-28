import type { APIRoute } from 'astro';
import { Liquid } from 'liquidjs';
import OpenAI from 'openai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import draft2020 from 'ajv/dist/2020';

// Ensure POST method is properly exported
export const prerender = false;

console.log("I'm inside the chat api!!!")

const openai = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY,
});

const engine = new Liquid({
  root: join(process.cwd(), 'src/templates'),
  extname: '.liquid'
});

// Load and compile JSON schema
const schemaPath = join(process.cwd(), 'src/schemas/mortigen_render_context.schema.json');
const schemaContent = readFileSync(schemaPath, 'utf-8');
const schema = JSON.parse(schemaContent);

const ajv = new draft2020({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

// Convert schema to formatted string for system context
const schemaString = JSON.stringify(schema, null, 2);

export const POST: APIRoute = async ({ request }) => {
  try {
    // Check if OpenAI API key is configured
    if (!import.meta.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      const errorHtml = `
        <div class="error-message">
          <h3>⚠️ Configuration Error</h3>
          <p>OpenAI API key is not configured. Please add your API key to the environment variables.</p>
        </div>
      `;
      return new Response(errorHtml, {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Read request body as text first
    const rawBody = await request.text();
    
    // Check if request body is empty
    if (!rawBody || rawBody.trim() === '') {
      console.error('Empty request body received');
      const errorHtml = `
        <div class="error-message">
          <h3>⚠️ Invalid Request</h3>
          <p>Request body is empty. Please provide consultation details.</p>
        </div>
      `;
      return new Response(errorHtml, {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Parse JSON with proper error handling
    let requestData;
    try {
      requestData = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('Failed to parse request body as JSON:', parseError);
      console.error('Raw body:', rawBody);
      const errorHtml = `
        <div class="error-message">
          <h3>⚠️ Invalid JSON</h3>
          <p>Request body contains malformed JSON. Please check your request format.</p>
        </div>
      `;
      return new Response(errorHtml, {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    const { prompt } = requestData;

    if (!prompt || typeof prompt !== 'string') {
      const errorHtml = `
        <div class="error-message">
          <h3>⚠️ Invalid Input</h3>
          <p>Please provide valid consultation details.</p>
        </div>
      `;
      return new Response(errorHtml, {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // System context for medical consultation with schema guidance
    const systemContext = `You are Consultologist, an AI assistant specialized in helping oncologists create structured consultation notes for breast cancer patients.

IMPORTANT CONTEXT:
- You are working with breast cancer oncology consultations
- Focus on staging, pathology, receptor status, and treatment planning
- Always consider TNM staging, hormone receptor status, HER2 status, and Oncotype DX scores when available
- Treatment plans should include endocrine therapy, chemotherapy, and radiation considerations
- Use evidence-based treatment recommendations

CRITICAL: You must respond with ONLY a valid JSON object that conforms to the following structure:

${schemaString}

REQUIREMENTS:
- Your response must be ONLY a valid JSON object that strictly conforms to this schema
- Do not include any explanatory text, markdown formatting, or additional commentary
- All required fields must be present and properly formatted
- Use the exact enum values specified in the schema
- Follow all pattern constraints (e.g., TNM staging patterns, receptor scoring patterns)
- Return only the JSON object, nothing else`;

    // Call OpenAI API with JSON mode
    console.log('Calling OpenAI API...');
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemContext },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: "json_object" }
    });

    const responseContent = completion.choices[0]?.message?.content;
    
    if (!responseContent) {
      console.error('No response content from OpenAI');
      throw new Error('No response from OpenAI');
    }

    console.log('OpenAI response received, parsing JSON...');
    // Parse JSON response from ChatGPT
    let consultationData;
    try {
      consultationData = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      console.error('Response content:', responseContent);
      throw new Error('Invalid JSON response from AI');
    }

    console.log('JSON parsed successfully, validating schema...');
    // Validate against schema
    const isValid = validate(consultationData);
    
    if (!isValid) {
      console.error('Schema validation failed:', validate.errors);
      console.error('Invalid data:', JSON.stringify(consultationData, null, 2));
      
      // Create a user-friendly error message
      const validationErrors = validate.errors?.map(error => {
        const path = error.instancePath || 'root';
        return `${path}: ${error.message}`;
      }).join(', ') || 'Unknown validation error';
      
      throw new Error(`AI response does not match expected format: ${validationErrors}`);
    }

    console.log('Schema validation passed, rendering template...');
    // Render HTML using Liquid template
    const html = await engine.renderFile('consult_response', consultationData);

    console.log('Template rendered successfully');
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('API Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    
    const errorHtml = `
      <div class="error-message">
        <h3>⚠️ Error Processing Request</h3>
        <p>Sorry, there was an error processing your consultation request. Please try again.</p>
        <details>
          <summary>Error Details</summary>
          <p class="error-details">${error instanceof Error ? error.message : 'Unknown error occurred'}</p>
        </details>
      </div>
    `;

    return new Response(errorHtml, {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
};