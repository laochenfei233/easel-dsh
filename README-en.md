# Easel-dsh

[中文](README.md) | English

<div align="center">

<img src="assets/readme/hero.svg" alt="Easel-dsh — a desktop social-media operations workbench built on DeepSeek Harness" width="100%">

[![License: MIT](https://img.shields.io/badge/License-MIT-3b82f6.svg)](LICENSE) [![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-6b7280.svg)](#build-from-source) [![Status](https://img.shields.io/badge/Status-Developer%20Preview-f59e0b.svg)](#safety-notice)

</div>

Easel-dsh is a desktop social-media operations workbench built on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): it brings topic discovery, breakdown, AI writing, scheduling, and publishing into one local-first desktop app, driven by composable agent skills.

> Inspired by [ZJU-REAL/Easel](https://github.com/ZJU-REAL/Easel), built on [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — thanks to both upstream projects.

<img src="assets/readme/workbench.png" alt="The Easel-dsh workbench" width="100%">

## Feature overview

| Module | Capabilities |
|---|---|
| Creation flow | Ideas inbox, task breakdown, AI skill writing, output library |
| Intelligence | Hotspot radar (cross-platform trends, watch keywords, article capture), content calendar (holiday data, CalDAV subscriptions) |
| Assets | Media library, skills, user profile; data stays local by default, with a movable data location in settings |
| Cross-device | Air Transfer: move sessions, content libraries, and configuration between devices over the LAN |
| Platform & models | Multi-account management, multi-model access, publishing outlets |

<img src="assets/readme/features.svg" alt="Easel-dsh core capabilities: one creation flow, local content assets, pluggable models" width="100%">

## Quick start

1. Download the installer for your platform from [GitHub Releases](https://github.com/laochenfei233/easel-dsh/releases) (Windows / macOS / Linux; the installer bundles its own Node runtime, no system environment needed).
2. Install and launch; upgrades install over the previous version without uninstalling first.
3. Sign in with a DeepSeek account in settings, or enter an API key to connect other models.
4. Create an idea and start your first piece from the hotspot radar or your own notes.

Data is stored by default in the Easel-dsh folder under your system Documents directory; the data location can be changed and migrated in settings, with WebDAV / SMB / S3 backups.

## Model access

- Sign in with a DeepSeek account, or paste an API key directly in settings.
- OpenAI-compatible access: bundled multi-provider data (including MiniMax) covers text and video generation models.
- The model adapter layer is itself a plugin — adding a provider never touches core code.

## How it works

```mermaid
flowchart LR
    R[Hotspot radar topics] --> I[Idea]
    I --> B[Breakdown]
    B --> A[AI skill writing]
    A --> O[Output library]
    O --> C[Calendar scheduling]
    C --> P[Publish]
    classDef input fill:#3B82F6,color:#fff
    classDef stage fill:#10B981,color:#fff
    classDef plan fill:#F59E0B,color:#fff
    classDef out fill:#8B5CF6,color:#fff
    class R input
    class I,B,A stage
    class O out
    class C plan
    class P out
```

Every feature surface is a plugin: the workbench UI, skill loading, model adapters, and session logs are independent and can be enabled, disabled, or replaced separately. Agents run skills inside sessions to complete creative work, and every run is preserved as a replayable session log.

## Architecture

Easel-dsh inherits the everything-is-a-plugin architecture of DeepSeek Harness: on top of [Cordis](https://github.com/cordiverse/cordis), model adapters, tool registries, session logs, and even the agent loop itself are plugins, composed in layers through profiles / bundles, pluggable via `cordis.yml`.

| Layer | Contents |
|---|---|
| Desktop shell | Tauri window + bundled Node runtime (`apps/desktop-tauri`) |
| Product layer | Workbench plugin `easel/dsh-plugin-easel` and `@easel-dsh/*` mount packages |
| Harness layer | `packages/*/*` groups: core (agent / sessions), llm (model access), skill (skills), client (web UI), shell / terminal (execution), and more |
| Composition layer | Bundles / profiles: `dsh-base` as the shared base, with product plugins stacked on top |

For the full architecture see [docs/architecture.md](docs/architecture.md); for the package-group overview see [packages/README.md](packages/README.md).

## Build from source

Requires Node.js ^22.19.0 || >=24.0.0 and pnpm 11:

```sh
git clone https://github.com/laochenfei233/easel-dsh.git
cd easel-dsh
pnpm install
pnpm run build
pnpm run dev:desktop
```

Package installers locally:

```sh
pnpm run package:desktop:win:x64
pnpm run package:desktop:mac:arm64
```

## Safety notice

Easel-dsh is developer-preview software. It executes model-generated code and commands, loads third-party plugins, and accesses the network and files; sandboxing and approval prompts reduce risk but are not a security boundary. Read [SAFETY.md](SAFETY.md) before first use.

## Contributing and license

- See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute; version history is in [CHANGELOG.md](CHANGELOG.md).
- This repository is released under MIT ([LICENSE](LICENSE)); the `easel/dsh-plugin-easel` workbench plugin is Apache-2.0; third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Use of the DeepSeek Harness name and brand assets follows [BRAND_GUIDELINES.md](BRAND_GUIDELINES.md).
