import { NextResponse } from "next/server";

// Use the same Esplora-compatible base as the tx endpoint
const ESPLORA_API_BASE =
  process.env.BITCOIN_API_BASE ?? "https://mempool.space/testnet4/api";

export async function GET() {
  try {
    const res = await fetch(`${ESPLORA_API_BASE}/mempool/recent`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Upstream API error (${res.status}) for mempool/recent`);
    }
    const data = (await res.json()) as { txid: string }[];
    const txids = data.slice(0, 5).map((t) => t.txid);

    return NextResponse.json({ txids });
  } catch (error) {
    console.error("Error fetching sample transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sample testnet transactions." },
      { status: 502 }
    );
  }
}

