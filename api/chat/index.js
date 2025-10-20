import { Liquid } from 'liquidjs';
import OpenAI from 'openai';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const engine = new Liquid();

const schemaPath = join(__dirname, '../../src/schemas/mortigen_render_context.schema.json');
const templatePath = join(__dirname, '../../src/templates/consult_response.liquid');

const schemaJson = JSON.parse(readFileSync(schemaPath, 'utf8'));
const templateContent = readFileSync(templatePath, 'utf8');

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schemaJson);

const schemaString = JSON.stringify(schemaJson, null, 2);

export default async function (context, req) {
  context.log("Chat function invoked");

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      context.log.error('OpenAI API key is not configured');
      const errorHtml = `
        <div class="error-message">
          <h3>⚠️ Configuration Error</h3>
          <p>OpenAI API key is not configured. Please add your API key to the environment variables.</p>
        </div>
      `;
      context.res = {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
        body: errorHtml
      };
      return;
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const rawBody = req.body;

    if (!rawBody) {
      context.log.error('Empty request body received');
      const errorHtml = `
        <div class="error-message">
          <h3>⚠️ Invalid Request</h3>
          <p>Request body is empty. Please provide consultation details.</p>
        </div>
      `;
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
        body: errorHtml
      };
      return;
    }

    const { prompt } = rawBody;

    if (!prompt || typeof prompt !== 'string') {
      const errorHtml = `
        <div class="error-message">
          <h3>⚠️ Invalid Input</h3>
          <p>Please provide valid consultation details.</p>
        </div>
      `;
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
        body: errorHtml
      };
      return;
    }

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

    context.log('Calling OpenAI API...');
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
      context.log.error('No response content from OpenAI');
      throw new Error('No response from OpenAI');
    }

    context.log('OpenAI response received, parsing JSON...');
    let consultationData;
    try {
      consultationData = JSON.parse(responseContent);
    } catch (parseError) {
      context.log.error('Failed to parse OpenAI response as JSON:', parseError);
      context.log.error('Response content:', responseContent);
      throw new Error('Invalid JSON response from AI');
    }

    context.log('JSON parsed successfully, validating schema...');
    const isValid = validate(consultationData);

    if (!isValid && validate.errors) {
      context.log.error('Schema validation failed:', validate.errors);
      context.log.error('Invalid data:', JSON.stringify(consultationData, null, 2));

      const validationErrors = validate.errors.map((error) => {
        const path = error.instancePath || 'root';
        return `${path}: ${error.message}`;
      }).join(', ') || 'Unknown validation error';

      throw new Error(`AI response does not match expected format: ${validationErrors}`);
    }

    context.log('Schema validation passed, rendering template...');
    const html = await engine.parseAndRender(templateContent, consultationData);

    context.log('Template rendered successfully');
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
      body: html
    };

  } catch (error) {
    context.log.error('API Error details:', {
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

    context.res = {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
      body: errorHtml
    };
  }
}
