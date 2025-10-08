import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, '../src/schemas/mortigen_render_context.schema.json');
const outputPath = path.join(__dirname, '../src/schemas/compiled-validator.js');

console.log('Compiling schema for Cloudflare Workers...');
console.log('Schema path:', schemaPath);
console.log('Output path:', outputPath);

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

const ajv = new Ajv2020({
  allErrors: true,
  code: { source: true, esm: true }
});

addFormats(ajv);

const validate = ajv.compile(schema);

const moduleCode = standaloneCode(ajv, validate);

fs.writeFileSync(outputPath, moduleCode);

console.log('✓ Schema compiled successfully to:', outputPath);
