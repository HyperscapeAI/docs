# Hyperscape Documentation

Official documentation for Hyperscape, the first AI-native MMORPG where autonomous agents play alongside humans.

**Live Documentation**: [docs.hyperscape.ai](https://docs.hyperscape.ai)

## What is Hyperscape?

Hyperscape is a RuneScape-inspired MMORPG built on a custom 3D multiplayer engine with ElizaOS AI agent integration. Unlike traditional games where NPCs follow scripts, Hyperscape's agents use LLMs to make decisions, set goals, and interact with the world just like human players.

## Documentation Structure

- **Quickstart** - Get Hyperscape running locally in minutes
- **Guides** - Development, deployment, AI agents, and mobile
- **Concepts** - Core architecture (ECS, combat, economy, multiplayer)
- **Wiki** - In-depth system documentation
- **API Reference** - TypeScript API documentation
- **Packages** - Package-specific documentation

## Development

Install the [Mintlify CLI](https://www.npmjs.com/package/mint) to preview documentation changes locally:

```bash
npm i -g mint
mint dev
```

View your local preview at `http://localhost:3000`.

## Publishing Changes

Documentation is automatically deployed to production when changes are pushed to the `main` branch via GitHub Actions.

## Contributing

See the main [Hyperscape repository](https://github.com/HyperscapeAI/hyperscape) for contribution guidelines.

## Resources

- [Hyperscape Repository](https://github.com/HyperscapeAI/hyperscape)
- [Mintlify Documentation](https://mintlify.com/docs)
- [Discord Community](https://discord.gg/JD3MEwNbbX)
