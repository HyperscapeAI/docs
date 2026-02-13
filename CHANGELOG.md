# Changelog

All notable changes to Hyperscape are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added - Mob Magic & Ranged Attacks (PR #826)

**Major Feature:** Mobs can now use magic and ranged attacks, not just melee.

#### Combat System
- Added `attackType` field to NPC combat configuration (`"melee"`, `"ranged"`, `"magic"`)
- Added `spellId` field for magic mobs (e.g., `"wind_strike"`)
- Added `arrowId` field for ranged mobs (e.g., `"bronze_arrow"`)
- Added `heldWeaponModel` field to NPC appearance for visual weapons (bows, staves)
- Added `prepareMobAttack()` shared utility in `AttackContext.ts` for mob attack validation
- Added mob-specific attack paths in `MagicAttackHandler` and `RangedAttackHandler`
- Added `emitMagicProjectile()` and `emitRangedProjectile()` shared methods
- Added `getMobAttackType()` type guard for safe attack type resolution

#### Combat Constants
- Added `MAGIC_RANGE: 10` - Maximum magic attack range
- Added `SPELL_LAUNCH_DELAY_MS: 600` - Spell cast wind-up delay
- Added `ARROW_LAUNCH_DELAY_MS: 400` - Bow draw wind-up delay

#### Visual System
- Added weapon attachment system in `MobVisualManager`
- Added static weapon cache (`_weaponCache`) to share GLB models across mobs
- Added concurrent load deduplication via `_pendingLoads` promise cache
- Added `clearWeaponCache()` method for world teardown
- Added `_destroyed` flag to prevent async weapon attach after mob destroy

#### Animation System
- Added `RANGE` emote mapping for ranged attacks
- Added `SPELL_CAST` emote mapping for magic attacks
- Updated `isPriorityEmote()` to use exact equality instead of substring matching
- Updated `isCombatEmote()` to include ranged and magic emotes

#### Type Definitions
- Added `attackType`, `spellId`, `arrowId` to `NPCCombatConfig`
- Added `heldWeaponModel` to `NPCAppearanceConfig`
- Added `attackType`, `spellId`, `arrowId` to `MobEntityConfig`
- Added `arrowId` and `travelDurationMs` to `COMBAT_PROJECTILE_LAUNCHED` event

#### Testing
- Added `MobProjectileAttack.integration.test.ts` with 13 test cases
- Tests cover magic/ranged routing, projectile emission, range validation, missing config handling

### Fixed - Inventory Write Coalescing (PR #823)

**Performance Fix:** Prevents database pool starvation during batch operations.

#### Database System
- Replaced per-player write locks with write coalescing
- Collapses N concurrent inventory writes into at most 2 DB transactions per player
- Prevents "200 pending operations" warnings during batch fletching/smithing
- Added `persistEmptyInventory()` helper to deduplicate death handler logic
- Added cleanup of `inventoryWriteLocks` map entries after promise chain settles
- Added rejection of orphaned write waiters on `DatabaseSystem.destroy()`

**Impact:** Batch operations (100+ items) now complete without freezing the game or exhausting database connections.

### Fixed - Equipment Panel Icons (PR #825)

- Fixed equipment panel to show actual item icons instead of SVG placeholders
- Updated `EquipmentPanel.tsx` to use item icon URLs from equipment data

### Fixed - Inventory Drag Icons (PR #789)

- Fixed inventory drag overlay showing wrong item icon
- Changed from array index lookup to slot-based `.find()` lookup
- Prioritizes drag data over slot lookup for accuracy

### Changed - Website Improvements (PR #822)

#### Next.js Upgrade
- Upgraded Next.js from 15.1.0 to 16.1.6
- Updated TypeScript config to use `jsx: "preserve"` for Next.js compatibility
- Added security headers in `next.config.ts`
- Added structured data for SEO optimization

#### Solana Wallet Integration
- Upgraded `@privy-io/react-auth` to 3.13.1
- Upgraded `@privy-io/server-auth` to 1.32.5
- Replaced `@solana-mobile/wallet-adapter-mobile` with `@solana-mobile/wallet-standard-mobile`
- Enhanced `SolanaWalletProvider` to support MWA on Saga and Seeker devices
- Removed deprecated `wallet_connect_qr_solana` (covered by `walletChainType`)
- Added balance fetching and MWA detection in `AccountPanel` and `SettingsPanel`

#### Gold Token Page
- Refactored into section components (TokenHero, ValueProps, HowItWorks)
- Added error boundaries and loading states
- Added opengraph images and manifest for SEO/PWA
- Improved accessibility (semantic HTML, ARIA labels)
- Added CSS variables for gold glow effects

---

## [3.0.0] - 2026-02-13

### Major Features

#### Mob Projectile Combat
- Mobs can now use magic spells and ranged arrows
- Full projectile system with visual synchronization
- Weapon attachment system for mob VRM avatars
- OSRS-accurate hit delay formulas for projectiles

#### Combat System Enhancements
- Three attack types: Melee, Ranged, Magic (for players AND mobs)
- Shared attack preparation utilities
- Pre-allocated damage params for zero-GC combat
- Proper animation routing by attack type

#### Performance Improvements
- Inventory write coalescing prevents database pool starvation
- Weapon model caching reduces network requests
- Concurrent load deduplication for mob weapons

---

## [2.0.0] - 2026-02-08

### Visual Smoothness - RS3 Parity
- Equipment visual fixes
- Animation improvements
- Inventory drag and drop enhancements

---

*For complete commit history, see [GitHub Releases](https://github.com/HyperscapeAI/hyperscape/releases)*
