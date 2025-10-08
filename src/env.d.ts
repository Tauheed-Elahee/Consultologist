/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    runtime?: {
      env: {
        OPENAI_API_KEY?: string;
      };
    };
  }
}