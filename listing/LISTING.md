# Pipegrid Lite: store listings

Nothing has been submitted. Build with `npm run package`; the same `dist/pipegrid-lite-1.0.0.vsix` goes to both stores.

## Visual Studio Marketplace: free, ready

1. Owner: sign in at https://marketplace.visualstudio.com/manage with a Microsoft account, create publisher ID **pnscripts** (name "PN Scripts"; the ID cannot change later).
2. Upload `dist/pipegrid-lite-1.0.0.vsix` with "New extension > Visual Studio Code" (web upload needs no token). For CLI publishing later: Microsoft Entra ID / workload identity federation, because global Azure DevOps PATs retire on 2026-12-01.
3. Optional: verify the domain pnscripts.com for the publisher (blue check).

Listing text comes from package.json and README.md. Icon `images/icon.png` 256×256 PNG; README images are https PNG (raw.githubusercontent.com), so the public GitHub repo `pnscripts/vscode-pipegrid-lite` must exist before publishing.

## Open VSX: free, ready

1. Owner: create an Eclipse Foundation account with the same GitHub login, sign in at https://open-vsx.org with GitHub, link the Eclipse account and accept the Publisher Agreement.
2. Create an access token (Settings > Access Tokens), then:
   `npx ovsx create-namespace pnscripts -p <token>` and `npx ovsx publish dist/pipegrid-lite-1.0.0.vsix -p <token>`.
3. Optional: claim the `pnscripts` namespace (removes the "unverified publisher" warning).

Extra images: `listing/screenshot-format-table-1280x800.png`, `listing/banner-1400x560.png` (social / GitHub preview).
