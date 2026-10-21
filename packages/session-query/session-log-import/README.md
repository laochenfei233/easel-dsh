---
description: "Host-side import of exported session ZIPs: materializes sessions into local persistence with a remapped work directory and restores referenced attachments."
kind: "package-library"
---

# @deepseek-ai/dsh-session-log-import

English | [中文](README.zh.md)

## Summary

The import counterpart of `@deepseek-ai/dsh-session-log-export`: it reads one exported session ZIP (canonical JSONL logs plus content-addressed images and files) and writes every contained session into the mounted persistence store, replacing each session header's recorded work directory with the importing device's project path. Subagent lineage travels as seeded descendants, whose fork-inherited cut is reconstructed from the seed marker event. Import refuses before writing when any log is malformed or any session id already exists locally; attachments are deposited through the mounted store's public API and verified to re-materialize under the ids the logs record.

## Table of Contents

- [Use this package](#use_this_package)

<a id="use_this_package"></a>
## Use this package

Mount the package as a plugin and call `ctx.sessionLogImporter.importArchive(zipBytes, { targetCwd })` with an absolute path on this device. The call returns the stored root session and its stored descendants. `targetCwd` is required: an imported session's tools must operate on this device's copy of the project, so the header `cwd` is rewritten rather than preserved. Sessions whose logs record no work directory keep none. A colliding session id, an unsupported format version, or an attachment that re-materializes under a different id all fail loudly with typed errors; nothing is silently renamed or partially linked.
