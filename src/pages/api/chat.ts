import type { APIRoute } from 'astro';
import { Liquid } from 'liquidjs';
import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';

const openai = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY,
});

const engine = new Liquid({
  root: join(process.cwd(), 'src/templates'),
  extname: '.liquid'
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid prompt provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // System context for medical consultation
    const systemContext = `You are Consultologist, an AI assistant specialized in helping physicians create consultation notes. You should respond with a JSON object containing structured medical consultation information.

Your response must be valid JSON with the following structure:
{
  "patient_summary": "Brief patient summary",
  "chief_complaint": "Main reason for consultation",
  "history_present_illness": "Detailed history of present illness",
  "assessment": "Clinical assessment and findings",
  "plan": "Treatment plan and recommendations",
  "follow_up": "Follow-up instructions"
}

Base your response on the consultation details provided by the physician. If information is missing, indicate that it needs to be obtained during the clinical encounter.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemContext },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
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