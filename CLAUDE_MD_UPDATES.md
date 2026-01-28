# CLAUDE.md Updates Required

The following updates should be made to `CLAUDE.md` in the HyperscapeAI/hyperscape repository:

## Architecture Overview Section

Add to the "Entity Component System (ECS)" or "RPG Implementation Architecture" section:

### Prayer System Architecture

The prayer system is a production-quality implementation following OSRS mechanics:

**Components:**
- `PrayerSystem` (`packages/shared/src/systems/shared/character/PrayerSystem.ts`) - Manages prayer state, drain, and activation
- `PrayerDataProvider` (`packages/shared/src/data/PrayerDataProvider.ts`) - Loads prayer definitions from `manifests/prayers.json`
- `BuryDelayManager` (`packages/shared/src/systems/shared/character/BuryDelayManager.ts`) - Enforces 2-tick bury cooldown
- `AltarEntity` (`packages/shared/src/entities/world/AltarEntity.ts`) - Prayer recharge stations

**Key Features:**
- Manifest-driven prayer definitions (no hardcoded prayers)
- OSRS-accurate drain formula: `drain_resistance = 2 × prayer_bonus + 60`
- Server-authoritative with comprehensive input validation
- Type guards for all network payloads
- Rate limiting (5 toggles/sec, 100ms cooldown)
- Conflict resolution (auto-deactivate conflicting prayers)
- Combat integration via multipliers to effective levels

**Database Schema:**
- `prayerLevel` - Prayer skill level (1-99)
- `prayerXp` - Prayer skill XP
- `prayerPoints` - Current prayer points (fractional precision)
- `prayerMaxPoints` - Maximum prayer points (equals prayer level)
- `activePrayers` - JSON array of active prayer IDs

**Security:**
- Prayer ID validation: `/^[a-z][a-z0-9_]{0,63}$/` (max 64 chars)
- Bounds checking on all numeric inputs
- Timestamp validation for replay attack prevention
- Rate limiting via `SlidingWindowRateLimiter`

---

**Note**: This information should be integrated into the existing CLAUDE.md architecture documentation, not added as a separate section.
