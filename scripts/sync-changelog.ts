#!/usr/bin/env bun
/**
 * Sync Changelog from GitHub Releases
 * 
 * This script fetches releases from the Hyperscape GitHub repository
 * and generates/updates the changelog.mdx file.
 * 
 * Usage:
 *   bun run scripts/sync-changelog.ts
 *   
 * Environment:
 *   GITHUB_TOKEN - Optional, for higher rate limits (public repos work without)
 *   
 * Can be run:
 *   - Locally during development
 *   - In CI/CD pipeline
 *   - As a pre-commit hook
 *   - Via GitHub Actions on schedule
 */

const GITHUB_OWNER = "HyperscapeAI";
const GITHUB_REPO = "hyperscape";
const CHANGELOG_FILE = "changelog.mdx";

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
}

async function fetchReleases(): Promise<GitHubRelease[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=50`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const releases = (await response.json()) as GitHubRelease[];
  
  // Filter out drafts and prereleases (optional - remove if you want them)
  return releases.filter((r) => !r.draft);
}

function formatReleaseBody(body: string): string {
  if (!body) return "No release notes provided.";

  return body
    // Demote headers for MDX nesting
    .replace(/^## /gm, "### ")
    .replace(/^# /gm, "### ")
    // Clean up line endings
    .replace(/\r\n/g, "\n")
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

function generateUpdateComponent(release: GitHubRelease): string {
  const date = new Date(release.published_at).toISOString().split("T")[0];
  const label = release.tag_name;
  const description = release.name || release.tag_name;
  const body = formatReleaseBody(release.body);
  const isPrerelease = release.prerelease ? ' badge="Pre-release"' : "";

  return `<Update label="${label}" description="${description}" date="${date}"${isPrerelease}>

${body}

[View release on GitHub](${release.html_url})

</Update>`;
}

function generateChangelogMDX(releases: GitHubRelease[]): string {
  const updates = releases.map(generateUpdateComponent).join("\n\n");

  return `---
title: "Changelog"
description: "Latest updates and releases from Hyperscape"
icon: "scroll"
rss: true
---

{/* 
  This changelog is automatically generated from GitHub Releases.
  Run: bun run scripts/sync-changelog.ts
  
  DO NOT EDIT MANUALLY - changes will be overwritten!
*/}

## Latest Releases

${updates}

---

## Subscribe

<CardGroup cols={2}>
  <Card title="RSS Feed" icon="rss" href="/changelog/rss.xml">
    Subscribe to changelog updates via RSS
  </Card>
  <Card title="Discord" icon="discord" href="https://discord.gg/JD3MEwNbbX">
    Get notified in our Discord
  </Card>
</CardGroup>

---

<Info>
  This changelog is automatically synced with [GitHub Releases](https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases).
</Info>
`;
}

async function main() {
  console.log(`📥 Fetching releases from ${GITHUB_OWNER}/${GITHUB_REPO}...`);

  try {
    const releases = await fetchReleases();
    console.log(`   Found ${releases.length} releases`);

    if (releases.length === 0) {
      console.log("⚠️  No releases found. Creating placeholder changelog.");
    }

    const mdx = generateChangelogMDX(releases);

    await Bun.write(CHANGELOG_FILE, mdx);
    console.log(`✅ Updated ${CHANGELOG_FILE}`);

    // List releases synced
    for (const release of releases.slice(0, 5)) {
      const date = new Date(release.published_at).toISOString().split("T")[0];
      console.log(`   - ${release.tag_name} (${date})`);
    }
    if (releases.length > 5) {
      console.log(`   ... and ${releases.length - 5} more`);
    }
  } catch (error) {
    console.error("❌ Error syncing changelog:", error);
    process.exit(1);
  }
}

main();
