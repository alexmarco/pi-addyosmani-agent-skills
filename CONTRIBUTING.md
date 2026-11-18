# Contributing

Contributions are welcome through GitHub pull requests.

## Development setup

1. Install Node.js 22.19 or newer.
2. Run `npm ci` to install the development dependencies.
3. Run `npm run check` before opening a pull request.

## Branches and pull requests

The project follows GitFlow. `main` is reserved for released versions; `develop` is the integration branch.

1. Create a `feature/<short-description>` or `bugfix/<short-description>` branch from `develop`.
2. Open a pull request targeting `develop` with a Conventional Commit title, such as `feat: register upstream commands`.
3. Keep pull requests focused and include tests for behavior changes.
4. All checks must pass before merging.

Do not commit credentials, access tokens, `.env` files, or personal data. Do not publish npm packages or create GitHub releases without explicit authorization.
