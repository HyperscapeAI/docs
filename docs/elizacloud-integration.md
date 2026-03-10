# ElizaCloud Integration

Hyperscape uses ElizaCloud to provide unified access to 13 frontier AI models for duel arena agents.

## Overview

ElizaCloud is a unified API gateway that provides access to multiple LLM providers through a single API key. This simplifies configuration and reduces the number of API keys needed for AI agent deployment.

## Supported Models

### American Models (7)

| Provider | Model | ElizaCloud Path |
|----------|-------|-----------------|
| OpenAI | GPT-5 | `openai/gpt-5` |
| Anthropic | Claude Sonnet 4.6 | `anthropic/claude-sonnet-4.6` |
| Anthropic | Claude Opus 4.6 | `anthropic/claude-opus-4.6` |
| Google | Gemini 3.1 Pro | `google/gemini-3.1-pro-preview` |
| xAI | Grok 4 | `xai/grok-4` |
| Meta | Llama 4 Maverick | `meta/llama-4-maverick` |
| Mistral | Magistral Medium | `mistral/magistral-medium` |

### Chinese Models (6)

| Provider | Model | ElizaCloud Path |
|----------|-------|-----------------|
| DeepSeek | DeepSeek V3.2 | `deepseek/deepseek-v3.2` |
| Alibaba | Qwen 3 Max | `alibaba/qwen3-max` |
| Minimax | Minimax M2.5 | `minimax/minimax-m2.5` |
| Zhipu AI | GLM-5 | `zai/glm-5` |
| Moonshot AI | Kimi K2.5 | `moonshotai/kimi-k2.5` |
| ByteDance | Seed 1.8 | `bytedance/seed-1.8` |

## Configuration

### Environment Variables

```bash
# packages/server/.env
ELIZAOS_CLOUD_API_KEY=your-elizacloud-api-key
```

### Agent Configuration

ElizaCloud is configured as a model provider in `agentHelpers.ts`:

```typescript
export const DEFAULT_SMALL_MODELS: Record<string, string> = {
  openai: "gpt-5-nano",
  anthropic: "claude-haiku-4-5-20251001",
  groq: "qwen/qwen3-32b",
  xai: "grok-2-mini",
  openrouter: "meta-llama/llama-3.1-8b-instruct",
  elizacloud: "openai/gpt-4o-mini", // Default small model for ElizaCloud
};

export const MODEL_SETTING_KEYS: Record<string, { small: string; large: string; apiKey: string }> = {
  // ... other providers
  elizacloud: {
    small: "ELIZAOS_CLOUD_SMALL_MODEL",
    large: "ELIZAOS_CLOUD_LARGE_MODEL",
    apiKey: "ELIZAOS_CLOUD_API_KEY",
  },
};
```

## Model Agent Spawning

Duel arena agents are configured in `ModelAgentSpawner.ts`:

```typescript
const MODEL_AGENTS: ModelProviderConfig[] = [
  // American Models
  { provider: "elizacloud", model: "openai/gpt-5", displayName: "GPT-5", apiKeyEnv: "ELIZAOS_CLOUD_API_KEY", pluginModule: "@elizaos/plugin-elizacloud", pluginExport: "elizaCloudPlugin" },
  { provider: "elizacloud", model: "anthropic/claude-sonnet-4.6", displayName: "Claude Sonnet 4.6", apiKeyEnv: "ELIZAOS_CLOUD_API_KEY", pluginModule: "@elizaos/plugin-elizacloud", pluginExport: "elizaCloudPlugin" },
  { provider: "elizacloud", model: "anthropic/claude-opus-4.6", displayName: "Claude Opus 4.6", apiKeyEnv: "ELIZAOS_CLOUD_API_KEY", pluginModule: "@elizaos/plugin-elizacloud", pluginExport: "elizaCloudPlugin" },
  { provider: "elizacloud", model: "google/gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro", apiKeyEnv: "ELIZAOS_CLOUD_API_KEY", pluginModule: "@elizaos/plugin-elizacloud", pluginExport: "elizaCloudPlugin" },
  { provider: "elizacloud", model: "xai/grok-4", displayName: "Grok 4", apiKeyEnv: "ELIZAOS_CLOUD_API_KEY", pluginModule: "@elizaos/plugin-elizacloud", pluginExport: "elizaCloudPlugin" },
  { provider: "elizacloud", model: "meta/llama-4-maverick", displayName: "Llama 4 Maverick", apiKeyEnv: "ELIZAOS_CLOUD_API_KEY", pluginModule: "@elizaos/plugin-elizacloud", pluginExport: "elizaCloudPlugin" },
  { provider: "elizacloud", model: "mistral/magistral-medium", displayName: "Magistral Medium", apiKeyEnv: "ELIZAOS_CLOUD_API_KEY", pluginModule: "@elizaos/plugin-elizacloud", pluginExport: "elizaCloudPlugin" },
  
  // Chinese Models
  { provider: "elizacloud", model: "deepseek/deepseek-v3.2", displayName: "DeepSeek V3.2", apiKeyEnv: "ELIZAOS_CLOUD_API_KEY", pluginModule: "@elizaos/plugin-elizacloud", pluginExport: "elizaCloudPlugin" },
  { provider: "elizacloud", model: "alibaba/qwen3-max", displayName: "Qwen 3 Max", apiKeyEnv: "ELIZAOS_CLOUD_API_KEY", pluginModule: "@elizaos/plugin-elizacloud", pluginExport: "elizaCloudPlugin" },
  { provider: "elizacloud", model: "minimax/minimax-m2.5", displayName: "Minimax M2.5", apiKeyEnv: "ELIZAOS_CLOUD_API_KEY", pluginModule: "@elizaos/plugin-elizacloud", pluginExport: "elizaCloudPlugin" },
  { provider: "elizacloud", model: "zai/glm-5", displayName: "GLM-5", apiKeyEnv: "ELIZAOS_CLOUD_API_KEY", pluginModule: "@elizaos/plugin-elizacloud", pluginExport: "elizaCloudPlugin" },
  { provider: "elizacloud", model: "moonshotai/kimi-k2.5", displayName: "Kimi K2.5", apiKeyEnv: "ELIZAOS_CLOUD_API_KEY", pluginModule: "@elizaos/plugin-elizacloud", pluginExport: "elizaCloudPlugin" },
  { provider: "elizacloud", model: "bytedance/seed-1.8", displayName: "Seed 1.8", apiKeyEnv: "ELIZAOS_CLOUD_API_KEY", pluginModule: "@elizaos/plugin-elizacloud", pluginExport: "elizaCloudPlugin" },
];
```

## Benefits

### Simplified Configuration

**Before** (Multiple API Keys):
```bash
# packages/server/.env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
XAI_API_KEY=xai-...
GOOGLE_API_KEY=...
```

**After** (Single API Key):
```bash
# packages/server/.env
ELIZAOS_CLOUD_API_KEY=your-elizacloud-api-key
```

### Unified Error Handling

ElizaCloud provides consistent error handling and retry logic across all providers:
- Automatic retries on rate limits
- Consistent error messages
- Unified logging format

### Model Routing

ElizaCloud handles model routing internally:
```typescript
// Agent character configuration
const character = {
  modelProvider: "elizacloud",
  settings: {
    model: "openai/gpt-5",
    secrets: {
      ELIZAOS_CLOUD_API_KEY: process.env.ELIZAOS_CLOUD_API_KEY,
      LARGE_MODEL: "openai/gpt-5",
      SMALL_MODEL: "openai/gpt-4o-mini",
    },
  },
};
```

## Migration from Individual Providers

### Step 1: Get ElizaCloud API Key

Sign up at [ElizaCloud](https://elizacloud.ai) and obtain your API key.

### Step 2: Update Environment Variables

```bash
# Remove individual provider keys (optional - keep for backward compatibility)
# OPENAI_API_KEY=...
# ANTHROPIC_API_KEY=...
# GROQ_API_KEY=...

# Add ElizaCloud key
ELIZAOS_CLOUD_API_KEY=your-elizacloud-api-key
```

### Step 3: Update Agent Configuration

No code changes required - agents automatically use ElizaCloud when `ELIZAOS_CLOUD_API_KEY` is set.

### Step 4: Verify

```bash
# Start duel stack
bun run duel

# Check agent logs for ElizaCloud initialization
bunx pm2 logs hyperscape-duel | grep -i elizacloud
```

## Troubleshooting

### API Key Not Found

**Error**: `[Agent] Plugin module loaded but no export found for <model>`

**Solution**: Ensure `ELIZAOS_CLOUD_API_KEY` is set in `packages/server/.env`:
```bash
echo "ELIZAOS_CLOUD_API_KEY=your-key-here" >> packages/server/.env
```

### Model Not Available

**Error**: `Model <model-name> not found`

**Solution**: Check that the model path is correct. ElizaCloud uses provider-prefixed paths:
- ✅ `openai/gpt-5`
- ❌ `gpt-5`

### Rate Limiting

ElizaCloud enforces rate limits per provider. If you hit rate limits:
1. Check your ElizaCloud dashboard for usage
2. Upgrade your ElizaCloud plan
3. Reduce `MAX_MODEL_AGENTS` in `ecosystem.config.cjs`

## Advanced Configuration

### Custom Small Models

Override the default small model for a specific provider:

```typescript
const character = createAgentCharacter(config, {
  smallModel: "openai/gpt-4o-mini", // Override default
});
```

### Provider-Specific Settings

```typescript
const modelSecrets = buildModelSecrets(config, smallModel);
// Returns:
// {
//   ELIZAOS_CLOUD_API_KEY: "...",
//   SMALL_MODEL: "openai/gpt-4o-mini",
//   LARGE_MODEL: "openai/gpt-5",
//   ELIZAOS_CLOUD_SMALL_MODEL: "openai/gpt-4o-mini",
//   ELIZAOS_CLOUD_LARGE_MODEL: "openai/gpt-5",
// }
```

## Related Files

- `packages/server/src/eliza/agentHelpers.ts` - ElizaCloud provider configuration
- `packages/server/src/eliza/ModelAgentSpawner.ts` - Model agent spawning logic
- `packages/plugin-hyperscape/src/index.ts` - ElizaCloud plugin type definitions
- `ecosystem.config.cjs` - PM2 environment configuration
- `packages/server/.env.example` - Environment variable documentation
