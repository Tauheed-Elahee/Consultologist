import type { APIRoute } from 'astro';
import { Liquid } from 'liquidjs';
import OpenAI from 'openai';
import { validate } from '../../schemas/compiled-validator.js';
import schemaJson from '../../schemas/mortigen_render_context.schema.json';
import templateContent from '../../templates/consult_response.liquid?raw';

type ValidateFunction = ((data: any) => boolean) & { errors?: Array<{ instancePath: string; message: string }> | null };

export const prerender = false;

const engine = new Liquid();

const schema = schemaJson;

const schemaString = JSON.stringify(schema, null, 2);

export async function POST(request: NextRequest) {
  console.log("I'm inside the chat function api!!!");
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    console.log('API Key check:', {
      hasApiKey: !!apiKey
    });

    if (!apiKey) {
      console.error('OpenAI API key is not configured');
      const errorHtml = `
        <div class="error-message">
          <h3>⚠️ Configuration Error</h3>
          <p>OpenAI API key is not configured. Please add your API key to the environment variables.</p>
        </div>
      `;
      return new Response(errorHtml, {
        status: 500,
        headers: {
          'Content-Type': 'text/html'
        }
      });
    }

    const rawBody = await request.text();

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
        headers: {
          'Content-Type': 'text/html'
        }
      });
    }

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
        headers: {
          'Content-Type': 'text/html'
        }
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
        headers: {
          'Content-Type': 'text/html'
        }
      });
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

    console.log('Calling OpenAI API...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemContext },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: "json_object" }
      })
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API request failed: ${openaiResponse.status}`);
    }

    const completion = await openaiResponse.json();
    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      console.error('No response content from OpenAI');
      throw new Error('No response from OpenAI');
    }

    console.log('OpenAI response received, parsing JSON...');
    let consultationData;
    try {
      consultationData = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      console.error('Response content:', responseContent);
      throw new Error('Invalid JSON response from AI');
    }

    console.log('JSON parsed successfully, validating schema...');
    const validator = validate as ValidateFunction;
    const isValid = validator(consultationData);

    if (!isValid && validator.errors) {
      console.error('Schema validation failed:', validator.errors);
      console.error('Invalid data:', JSON.stringify(consultationData, null));

      const validationErrors = validator.errors.map((error) => {
        const path = error.instancePath || 'root';
        return `${path}: ${error.message}`;
      }).join(', ') || 'Unknown validation error';

      throw new Error(`AI response does not match expected format: ${validationErrors}`);
    }

    console.log('Schema validated:', JSON.stringify(consultationData, null));
    console.log('Schema validation passed, rendering template...');

    let html: string;
    try {
      html = await engine.parseAndRender(templateContent, consultationData);
      console.log('Template rendered successfully');
      console.log('Rendered HTML length:', html.length);
      console.log('Rendered HTML:', html);
    } catch (renderError) {
      console.error('Error rendering template:', renderError);
      throw renderError;
    }

    console.log('Returning Response...');

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    };

    console.log('Response headers object created');

    const response = new Response(html, {
      status: 200,
      headers: responseHeaders
    });

    console.log('Response object created, about to return');

    return response;

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
      headers: {
        'Content-Type': 'text/html'
      }
    });
  }
};