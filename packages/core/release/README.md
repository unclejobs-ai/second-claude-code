# Core release artifact

`second-claude-core-4.0.0.tgz` is the checked-in, prebuilt package consumed by host integrations. Its adjacent `.sha256` file pins the artifact bytes.

Maintainers regenerate both files from the repository root with:

```sh
npm run release:core
```

The release command first verifies that the checked-in `dist` directory exactly matches a clean strict TypeScript build. Plugin startup never runs this command and never compiles or fetches dependencies.
