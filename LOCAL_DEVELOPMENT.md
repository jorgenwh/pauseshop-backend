# Local Development Guide

This guide explains how to set up your local development environment for the PauseShop server.

## Environment Variables

For security reasons, API keys are not stored in the repository. You need to set them up locally.

### For Local Node.js Development

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and add your API keys:
   ```
   # Choose your preferred provider
   ANALYSIS_PROVIDER=gemini
   
   # Add your API key for the chosen provider
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. Run the server:
   ```bash
   npm run dev
   ```

### For Docker Development

1. Create a local Docker environment file:
   ```bash
   cp .env.docker .env.docker.local
   ```

2. Add your API key to `.env.docker.local`:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. Run with Docker Compose:
   ```bash
   docker-compose --env-file .env.docker.local up
   ```

## Getting API Keys

- **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- **OpenRouter API Key**: Get from [OpenRouter](https://openrouter.ai/keys)
- **Requesty API Key**: Get from [Requesty](https://requesty.com/)

## CI/CD Pipeline

The CI/CD pipeline uses GitHub Secrets to securely handle API keys. No action is needed for local development.

## Security Notes

- Never commit API keys to the repository
- The `.gitignore` file is configured to exclude all `.env.*` files except `.env.example`
- For additional security, consider rotating your API keys periodically