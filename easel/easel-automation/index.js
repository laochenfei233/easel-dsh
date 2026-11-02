// Thin mount over the core easel plugin (see package.json): the shell's
// loader row resolves this package, and the implementation rides
// dsh-plugin-easel's exports map. The bare specifier resolves at runtime
// against the sibling payload under $DSH_HOME/profiles/node_modules — the two
// payloads are always staged and refreshed together.
export * from 'dsh-plugin-easel/automation'
