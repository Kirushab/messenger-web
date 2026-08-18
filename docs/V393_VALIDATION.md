# v393 validation

- Source-level TypeScript/JSX syntax checked.
- Design-token and secret scans executed where dependencies were not required.
- Full dependency-backed release build is not claimed unless `npm run verify:release` succeeds in CI/local environment.
