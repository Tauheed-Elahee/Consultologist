import type { APIRoute } from 'astro';
import { Liquid } from 'liquidjs';
import { AzureOpenAI } from 'openai';
import { DefaultAzureCredential } from '@azure/identity';
import { validate } from '../../schemas/compiled-validator.js';
import schemaJson from '../../schemas/mortigen_render_context.schema.json';
import templateContent from '../../templates/consult_response.liquid?raw';

type ValidateFunction = ((data: any) => boolean) & { errors?: Array<{ instancePath: string; message: string }> | null };

const engine = new Liquid();

const schema = schemaJson;

const schemaString = JSON.stringify(schema, null, 2);

export const POST: APIRoute = async ({ request, locals }) => {
  console.log("I'm inside the chat function api!!!");
  try {
    const endpoint = locals.runtime?.env?.AZURE_OPENAI_ENDPOINT || import.meta.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = locals.runtime?.env?.AZURE_OPENAI_DEPLOYMENT_NAME || import.meta.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiVersion = locals.runtime?.env?.AZURE_OPENAI_API_VERSION || import.meta.env.AZURE_OPENAI_API_VERSION;

    console.log('Azure OpenAI Configuration check:', {
      hasEndpoint: !!endpoint,
      hasDeploymentName: !!deploymentName,
      hasApiVersion: !!apiVersion,
      endpoint: endpoint,
      deploymentName: deploymentName
    });

    if (!endpoint || !deploymentName || !apiVersion) {
      console.error('Azure OpenAI configuration is incomplete');
      const errorHtml = `
        <div class="error-message">
          <h3>⚠️ Configuration Error</h3>
          <p>Azure OpenAI configuration is incomplete. Please ensure AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT_NAME, and AZURE_OPENAI_API_VERSION are set.</p>
        </div>
      `;
      return new Response(errorHtml, {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    const credential = new DefaultAzureCredential();
    const scope = "https://cognitiveservices.azure.com/.default";

    const openai = new AzureOpenAI({
      endpoint: endpoint,
      apiVersion: apiVersion,
      azureADTokenProvider: async () => {
        const token = await credential.getToken(scope);
        return token.token;
      },
    });

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

    // Call Azure OpenAI API with JSON mode
    console.log('Calling Azure OpenAI API...');
    const completion = await openai.chat.completions.create({
      model: deploymentName,
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
      console.error('No response content from Azure OpenAI');
      throw new Error('No response from Azure OpenAI');
    }

    console.log('Azure OpenAI response received, parsing JSON...');
    // Parse JSON response from ChatGPT
    let consultationData;
    try {
      consultationData = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('Failed to parse Azure OpenAI response as JSON:', parseError);
      console.error('Response content:', responseContent);
      throw new Error('Invalid JSON response from AI');
    }

    console.log('JSON parsed successfully, validating schema...');
    // Validate against schema (cast to include errors property)
    const validator = validate as ValidateFunction;
    const isValid = validator(consultationData);

    if (!isValid && validator.errors) {
      console.error('Schema validation failed:', validator.errors);
      console.error('Invalid data:', JSON.stringify(consultationData, null, 2));

      // Create a user-friendly error message
      const validationErrors = validator.errors.map((error) => {
        const path = error.instancePath || 'root';
        return `${path}: ${error.message}`;
      }).join(', ') || 'Unknown validation error';

      throw new Error(`AI response does not match expected format: ${validationErrors}`);
    }

    console.log('Schema validation passed, rendering template...');
    const html = await engine.parseAndRender(templateContent, consultationData);

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
