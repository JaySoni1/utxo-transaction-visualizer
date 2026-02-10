# UTXO Transaction Visualizer & Explainer (Bitcoin Testnet4)

An interactive web app that helps you *see* how Bitcoin’s UTXO model works:

- Inputs (spent UTXOs) on the left
- The transaction in the middle (with fee calculation)
- Outputs (new UTXOs) on the right, including a “likely change” highlight
- Step-by-step explanation mode (Beginner / Technical)
- Raw transaction hex + decoded summary
- Before vs after UTXO-set fragment visualization

## Tech stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- Esplora-compatible blockchain API (default: mempool.space **testnet4**)

## Getting started

Install deps and run the dev server:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Data source configuration

By default the backend fetches from:

- `https://mempool.space/testnet4/api`

You can override this by setting an environment variable:

- `BITCOIN_API_BASE` (must be an Esplora-compatible API base URL)

Example (PowerShell):

```powershell
$env:BITCOIN_API_BASE="https://mempool.space/testnet4/api"
npm run dev
```

