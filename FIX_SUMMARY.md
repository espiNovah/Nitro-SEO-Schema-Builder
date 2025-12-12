# WebPage Schema Keyword Generation Fix

## Issue
The WebPage schema generation was producing only a single keyword or very few keywords, instead of a comprehensive list.

## Fix
Updated `app.js` to improve the prompt and system instructions for the AI model, and enhanced the keyword processing logic.

### Changes
1.  **Prompt Update**: Modified `buildPrompt` for `WebPage` schema to explicitly request a "comprehensive list of 10 to 20 page-specific keywords".
2.  **System Instruction Update**: Modified `getSystemInstruction` to reinforce the requirement of generating "at least 10 keywords" and mixing seed keywords with new ones.
3.  **Instruction Clarity**: Added "MUST" and specific constraints to the prompt to guide the model better.
4.  **Keyword Processing**: Updated `enhanceSchema` to deduplicate and clean the keywords array returned by the AI before joining them into a string, ensuring a cleaner output similar to the original Python notebook.

## Expected Outcome
The AI should now generate a JSON-LD schema for `WebPage` that includes a `keywords` field with a comma-separated string of at least 10 relevant, unique keywords, derived from both the provided seed keywords and the page content.
