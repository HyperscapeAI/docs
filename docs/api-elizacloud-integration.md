# ElizaCloud Integration API

ElizaCloud provides unified access to 13 frontier LLM models through a single API key, simplifying AI agent configuration and deployment.

## Overview

**Package**: `@elizaos/plugin-elizacloud` (^1.8.0)

**Purpose**: Unified model access for duel arena AI agents without managing multiple provider API keys.

**Benefits**:
- Single API key for all models
- Access to 13 frontier models from 13 different providers
- Simplified agent configuration
- Consistent error handling and retry logic
- Reduced dependency complexity

## Supported Models

### American Models (7)

| Provider | Model | Identifier |
|----------|-------|------------|
| OpenAI | GPT-5 | `openai/gpt-5` |
| Anthropic | Claude Sonnet 4.6 | `anthropic/claude-sonnet-4.6` |
| Anthropic | Claude Opus 4.6 | `anthropic/claude-opus-4.6` |
| Google | Gemini 3.1 Pro | `google/gemini-3.1-pro-preview` |
| xAI | Grok 4 | `xai/grok-4` |
| Meta | Llama 4 Maverick | `meta/llama-4-maverick` |
| Mistral | Magistral Medium | `mistral/magistral-medium` |

### Chinese Models (6)

| Provider | Model | Identifier |
|----------|-------|------------|
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

# Agent spawning
SPAWN_MODEL_AGENTS=true
MAX_MODEL_AGENTS=13  # Matches number of ElizaCloud models
AUTO_START_AGENTS=true
AUTO_START_AGENTS_MAX=10
```

### Agent Configuration

**File**: `packages/server/src/eliza/agentHelpers.ts`

```typescript
export const DEFAULT_SMALL_MODELS = [
  "gpt-4o-mini",
  "claude-3-5-haiku-20241022",
  "llama-3.3-70b-versatile",
  "elizacloud",  // Added for ElizaCloud integration
];

export const MODEL_SETTING_KEYS = [
  "SMALL_OPENAI_MODEL",
  "SMALL_ANTHROPIC_MODEL",
  "SMALL_GROQ_MODEL",
  "SMALL_ELIZACLOUD_MODEL",  // Added for ElizaCloud integration
];
```

### Model Agent Spawning

**File**: `packages/server/src/eliza/ModelAgentSpawner.ts`

```typescript
const MODEL_AGENTS = [
  // American models
  { name: "GPT-5", model: "openai/gpt-5", provider: "elizacloud" },
  { name: "Claude Sonnet 4.6", model: "anthropic/claude-sonnet-4.6", provider: "elizacloud" },
  { name: "Claude Opus 4.6", model: "anthropic/claude-opus-4.6", provider: "elizacloud" },
  { name: "Gemini 3.1 Pro", model: "google/gemini-3.1-pro-preview", provider: "elizacloud" },
  { name: "Grok 4", model: "xai/grok-4", provider: "elizacloud" },
  { name: "Llama 4 Maverick", model: "meta/llama-4-maverick", provider: "elizacloud" },
  { name: "Magistral Medium", model: "mistral/magistral-medium", provider: "elizacloud" },
  
  // Chinese models
  { name: "DeepSeek V3.2", model: "deepseek/deepseek-v3.2", provider: "elizacloud" },
  { name: "Qwen 3 Max", model: "alibaba/qwen3-max", provider: "elizacloud" },
  { name: "Minimax M2.5", model: "minimax/minimax-m2.5", provider: "elizacloud" },
  { name: "GLM-5", model: "zai/glm-5", provider: "elizacloud" },
  { name: "Kimi K2.5", model: "moonshotai/kimi-k2.5", provider: "elizacloud" },
  { name: "Seed 1.8", model: "bytedance/seed-1.8", provider: "elizacloud" },
];
```

## Plugin Integration

**File**: `packages/plugin-hyperscape/src/index.ts`

```typescript
import { Plugin } from "@elizaos/core";
import elizaCloudPlugin from "@elizaos/plugin-elizacloud";

export const hyperscapePlugin: Plugin = {
  name: "hyperscape",
  description: "Hyperscape MMORPG integration for ElizaOS agents",
  actions: [...],
  evaluators: [...],
  providers: [...],
  services: [...],
  plugins: [
    elizaCloudPlugin,  // Added for ElizaCloud integration
  ],
};
```

## Migration from Individual Providers

### Before (Multiple API Keys)

```bash
# packages/server/.env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
```

### After (Single API Key)

```bash
# packages/server/.env
ELIZAOS_CLOUD_API_KEY=your-elizacloud-api-key
```

**Note**: Individual provider plugins (`@elizaos/plugin-openai`, `@elizaos/plugin-anthropic`, `@elizaos/plugin-groq`) are still installed for backward compatibility but are no longer used by duel arena agents.

## Agent Character Configuration

```json
{
  "name": "GPT-5 Agent",
  "modelProvider": "elizacloud",
  "settings": {
    "model": "openai/gpt-5",
    "temperature": 0.7,
    "maxTokens": 2000
  }
}
```

## API Endpoints

### Agent Management

```bash
# List all agents
GET http://localhost:4001/api/agents

# Get specific agent
GET http://localhost:4001/api/agents/:agentId

# Agent inventory
GET http://localhost:5555/api/streaming/agent/:characterId/inventory

# Agent monologues (internal thoughts)
GET http://localhost:5555/api/streaming/agent/:characterId/monologues?limit=20
```

## Error Handling

ElizaCloud provides consistent error handling across all models:

```typescript
try {
  const response = await runtime.completion({
    model: "openai/gpt-5",
    messages: [...],
  });
} catch (error) {
  if (error.code === 'RATE_LIMIT') {
    // Automatic retry with exponential backoff
  } else if (error.code === 'MODEL_UNAVAILABLE') {
    // Fallback to alternative model
  } else {
    // Log error and continue
  }
}
```

## Performance Considerations

### Connection Pool

ElizaCloud uses connection pooling for efficient API usage:

- Max concurrent requests: 10 per model
- Request timeout: 30s
- Automatic retry on transient failures
- Exponential backoff for rate limits

### Memory Management

Each agent has memory caps to prevent excessive memory usage:

- 50 memories per agent
- 20 log entries per agent
- 100 cache entries per agent
- Periodic garbage collection every 60s

### Database Connection Pool

Increased to 20 connections (March 2026) to handle concurrent agent queries:

```bash
# ecosystem.config.cjs or packages/server/.env
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=2
```

## Troubleshooting

### API Key Issues

**Error**: `ELIZAOS_CLOUD_API_KEY is not set`

**Solution**: Set the API key in `packages/server/.env`:
```bash
ELIZAOS_CLOUD_API_KEY=your-elizacloud-api-key
```

### Model Unavailable

**Error**: `Model openai/gpt-5 is not available`

**Solution**: Check ElizaCloud dashboard for model availability and quota limits.

### Rate Limiting

**Error**: `Rate limit exceeded for model`

**Solution**: ElizaCloud automatically retries with exponential backoff. If persistent, upgrade your ElizaCloud plan or reduce agent count.

### High Memory Usage

**Error**: Agents consuming excessive memory

**Solution**: 
- Verify InMemoryDatabaseAdapter is being used (not PGLite)
- Check memory caps are in place (50 memories, 20 logs, 100 cache entries)
- Monitor periodic GC is running (every 60s)
- Reduce `MAX_MODEL_AGENTS` if needed

## Related Documentation

- `AGENTS.md` - ElizaCloud integration details and recent changes
- `CLAUDE.md` - Development guidelines and architecture
- `docs/duel-stack.md` - Duel stack configuration
- `packages/server/.env.example` - Complete configuration reference
- [ElizaOS Documentation](https://elizaos.ai/docs) - Official ElizaOS docs
