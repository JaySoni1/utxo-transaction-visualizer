import { NextResponse } from "next/server";
import {
  EnrichedInput,
  EnrichedOutput,
  TxExplainerResponse,
} from "@/types/bitcoin";

// Esplora-compatible API (Blockstream, mempool.space, etc.).
// Default points to mempool.space testnet4; override with BITCOIN_API_BASE if needed.
const ESPLORA_API_BASE =
  process.env.BITCOIN_API_BASE ?? "https://mempool.space/testnet4/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${ESPLORA_API_BASE}${path}`, {
    // Always fetch fresh data for interactive exploration
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstream API error (${res.status}) for ${path}`);
  }
  return (await res.json()) as T;
}

async function fetchText(path: string): Promise<string> {
  const res = await fetch(`${ESPLORA_API_BASE}${path}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstream API error (${res.status}) for ${path}`);
  }
  return await res.text();
}

function satsFromOutputs(outputs: { value: number }[]): number {
  return outputs.reduce((sum, o) => sum + (o?.value ?? 0), 0);
}

function guessChangeOutputIndex(
  inputs: EnrichedInput[],
  outputs: EnrichedOutput[]
): number | null {
  if (outputs.length < 2) return null;

  const inputAddresses = new Set(
    inputs.map((i) => i.address).filter((a): a is string => !!a)
  );

  // Prefer outputs going back to an address that also appears on the input side.
  let candidates = outputs
    .map((o, idx) => ({ o, idx }))
    .filter(({ o }) => o.address && inputAddresses.has(o.address));

  if (candidates.length === 0) {
    candidates = outputs.map((o, idx) => ({ o, idx }));
  }

  const DUST_THRESHOLD = 1000; // sats
  const nonDust = candidates.filter(({ o }) => o.value > DUST_THRESHOLD);
  const base = nonDust.length > 0 ? nonDust : candidates;

  base.sort((a, b) => a.o.value - b.o.value); // smallest as likely change
  return base[0]?.idx ?? null;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ txid: string }> }
) {
  const { txid: rawTxid } = await context.params;
  const txid = (rawTxid ?? "").trim();

  if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
    return NextResponse.json(
      { error: "Please provide a valid 64-character hex transaction id." },
      { status: 400 }
    );
  }

  try {
    type BlockstreamTx = {
      txid: string;
      fee: number;
      version: number;
      locktime: number;
      size: number;
      weight: number;
      vin: {
        txid: string;
        vout: number;
        is_coinbase?: boolean;
      }[];
      vout: {
        value: number;
        scriptpubkey_address?: string;
        scriptpubkey_type?: string;
      }[];
      status: {
        confirmed: boolean;
        block_height?: number;
        block_hash?: string;
        block_time?: number;
      };
    };

    const [tx, rawHex, outspends] = await Promise.all([
      fetchJson<BlockstreamTx>(`/tx/${txid}`),
      fetchText(`/tx/${txid}/hex`),
      fetchJson<
        {
          spent: boolean;
        }[]
      >(`/tx/${txid}/outspends`),
    ]);

    // For each input, fetch the previous transaction to learn the UTXO it is spending.
    const prevTxs = await Promise.all(
      tx.vin.map((vin) =>
        vin.is_coinbase ? null : fetchJson<BlockstreamTx>(`/tx/${vin.txid}`)
      )
    );

    const enrichedInputs: EnrichedInput[] = tx.vin.map((vin, index) => {
      const prevTx = prevTxs[index];
      const prevOut =
        prevTx && typeof vin.vout === "number"
          ? prevTx.vout[vin.vout]
          : undefined;

      return {
        txid: vin.txid,
        vout: vin.vout,
        value: prevOut?.value ?? 0,
        address: prevOut?.scriptpubkey_address ?? null,
        scriptType: (prevOut?.scriptpubkey_type as any) ?? null,
        isCoinbase: !!vin.is_coinbase,
      };
    });

    const enrichedOutputs: EnrichedOutput[] = tx.vout.map((vout, index) => {
      const spendInfo = outspends[index];
      return {
        txid,
        vout: index,
        value: vout.value,
        address: vout.scriptpubkey_address ?? null,
        scriptType: (vout.scriptpubkey_type as any) ?? null,
        spent: spendInfo?.spent ?? false,
      };
    });

    const totalInput = enrichedInputs.reduce(
      (sum, i) => sum + (i.value ?? 0),
      0
    );
    const totalOutput = satsFromOutputs(tx.vout);
    const fee = tx.fee ?? Math.max(totalInput - totalOutput, 0);

    const result: TxExplainerResponse = {
      txid: tx.txid,
      fee,
      totalInput,
      totalOutput,
      inputs: enrichedInputs,
      outputs: enrichedOutputs,
      status: {
        confirmed: tx.status.confirmed,
        blockHeight: tx.status.block_height ?? null,
        blockHash: tx.status.block_hash ?? null,
        blockTime: tx.status.block_time ?? null,
      },
      details: {
        version: tx.version,
        locktime: tx.locktime,
        size: tx.size,
        weight: tx.weight,
        vinCount: tx.vin.length,
        voutCount: tx.vout.length,
      },
      rawHex,
      changeOutputIndex: guessChangeOutputIndex(enrichedInputs, enrichedOutputs),
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error fetching transaction:", error);
    return NextResponse.json(
      {
        error:
          "Failed to fetch or decode transaction from Blockstream testnet API.",
      },
      { status: 502 }
    );
  }
}

