# Pipegrid Lite: store listings

Status 2026-10-16: **1.0.0 is live** on the Visual Studio Marketplace (https://marketplace.visualstudio.com/items?itemName=pnscripts.pipegrid-lite) and Open VSX (https://open-vsx.org/extension/pnscripts/pipegrid-lite). **1.1.0 is built and checked** (Ctrl+V of spreadsheet cells as a table; 36 unit tests; the .vsix installed in VS Code 1.141.2 and 1.85.2) and waits for the owner's upload: VS Code Marketplace web upload of `dist/pipegrid-lite-1.1.0.vsix` (Manage > pipegrid-lite > Update) and `npx ovsx publish dist/pipegrid-lite-1.1.0.vsix -p <token>`; also attached to the GitHub release v1.1.0. Build with `npm run package`; the same file goes to both stores.

## Visual Studio Marketplace: free, ready

1. Owner: sign in at https://marketplace.visualstudio.com/manage with a Microsoft account, create publisher ID **pnscripts** (name "PN Scripts"; the ID cannot change later).
2. Upload `dist/pipegrid-lite-1.1.0.vsix` with "New extension > Visual Studio Code" (web upload needs no token). For CLI publishing later: Microsoft Entra ID / workload identity federation, because global Azure DevOps PATs retire on 2026-12-01.
3. Optional: verify the domain pnscripts.com for the publisher (blue check).

Listing text comes from package.json and README.md. Icon `images/icon.png` 256×256 PNG; README images are https PNG (raw.githubusercontent.com), so the public GitHub repo `pnscripts/vscode-pipegrid-lite` must exist before publishing.

## Open VSX: free, ready

1. Owner: create an Eclipse Foundation account with the same GitHub login, sign in at https://open-vsx.org with GitHub, link the Eclipse account and accept the Publisher Agreement.
2. Create an access token (Settings > Access Tokens), then:
   `npx ovsx create-namespace pnscripts -p <token>` and `npx ovsx publish dist/pipegrid-lite-1.1.0.vsix -p <token>`.
3. Optional: claim the `pnscripts` namespace (removes the "unverified publisher" warning).

Extra images: `listing/screenshot-format-table-1280x800.png`, `listing/banner-1400x560.png` (social / GitHub preview).
