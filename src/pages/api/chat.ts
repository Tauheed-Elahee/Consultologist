import type { APIRoute } from 'astro';
import { Liquid } from 'liquidjs';
import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';

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

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

export const POST: APIRoute = async ({ request }) => {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid prompt provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
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

The JSON object must contain:
- front_matter: Core structured data including patient demographics, staging (TNM classification), pathology details, receptor status (ER, PR, HER2), treatment plans, medications, and allergies
- content: Narrative sections including reason for consultation, history of present illness, past medical history, social/family history, physical exam, and investigations
- extras: Additional context like tumor laterality (left/right)
- flags: Boolean indicators for data presence

Key requirements:
- Patient demographics with proper pronouns (nom/gen/obj/refl)
- TNM staging with proper prefix (p/c/yp/yc/x) and valid T/N/M classifications
- Pathology with histology, grade (1-3), tumor size, and lymph node details
- Receptor status: ER/PR as scores (0-8/8), HER2 with detailed status
- Structured treatment plans for endocrine therapy, chemotherapy, and radiation
- Medications with proper dosing and frequency information

Do not include any explanatory text, markdown formatting, or additional commentary. Return only the JSON object.`;

    // Call OpenAI API with JSON mode
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemContext },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const responseContent = completion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response from ChatGPT
    let consultationData;
    try {
      consultationData = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', responseContent);
      throw new Error('Invalid JSON response from AI');
    }

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

    // Render HTML using Liquid template
    const html = await engine.renderFile('consult_response', consultationData);

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('API Error:', error);
    
    const errorHtml = `
      <div class="error-message">
        <h3>⚠️ Error Processing Request</h3>
        <p>Sorry, there was an error processing your consultation request. Please try again.</p>
        <p class="error-details">${error instanceof Error ? error.message : 'Unknown error occurred'}</p>
      </div>
    `;

    return new Response(errorHtml, {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
};