/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    runtime?: {
      env: {
        AZURE_OPENAI_ENDPOINT?: string;
        AZURE_OPENAI_DEPLOYMENT_NAME?: string;
        AZURE_OPENAI_API_VERSION?: string;
        OPENAI_API_KEY?: string;
      };
    };
  }
}