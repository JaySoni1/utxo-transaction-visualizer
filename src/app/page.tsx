/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  EnrichedInput,
  EnrichedOutput,
  TxExplainerResponse,
} from "@/types/bitcoin";

type Mode = "beginner" | "technical";

type ExplainStep = 1 | 2 | 3 | 4 | 5;

function satsToBtc(value: number): string {
  return (value / 1e8).toFixed(8);
}

function formatScriptType(scriptType: string | null): string {
  if (!scriptType) return "Unknown script";
  switch (scriptType) {
    case "p2pkh":
      return "P2PKH (Legacy)";
    case "p2wpkh":
      return "P2WPKH (Native SegWit)";
    case "p2sh":
      return "P2SH (Script Hash)";
    case "v0_p2wsh":
      return "P2WSH (SegWit script)";
    case "v1_p2tr":
      return "P2TR (Taproot)";
    default:
      return scriptType;
  }
}

interface HoverState {
  kind: "input" | "output" | null;
  index: number | null;
}

export default function Home() {
  const [txidInput, setTxidInput] = useState("");
  const [samples, setSamples] = useState<string[]>([]);
  const [loadingSamples, setLoadingSamples] = useState(false);

  const [tx, setTx] = useState<TxExplainerResponse | null>(null);
  const [loadingTx, setLoadingTx] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("beginner");
  const [step, setStep] = useState<ExplainStep>(1);
  const [hover, setHover] = useState<HoverState>({ kind: null, index: null });

  useEffect(() => {
    const loadSamples = async () => {
      try {
        setLoadingSamples(true);
        const res = await fetch("/api/samples");
        const data = await res.json();
        if (res.ok && Array.isArray(data.txids)) {
          setSamples(data.txids);
        }
      } catch {
        // Non-fatal; just skip samples if it fails.
      } finally {
        setLoadingSamples(false);
      }
    };
    loadSamples();
  }, []);

  const handleLoadTx = async (incomingTxid?: string) => {
    const txid = (incomingTxid ?? txidInput).trim();
    if (!txid) return;
    setError(null);
    setLoadingTx(true);
    setTx(null);
    setStep(1);
    try {
      const res = await fetch(`/api/tx/${txid}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load transaction.");
      }
      setTx(data as TxExplainerResponse);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading the transaction."
      );
    } finally {
      setLoadingTx(false);
    }
  };

  const highlight = useMemo(
    () => ({
      inputs: step === 1 || step === 2 || step === 5,
      outputs: step === 1 || step === 3 || step === 5,
      fee: step === 4,
    }),
    [step]
  );

  const currentHoverExplanation = useMemo(() => {
    if (!tx || hover.kind === null || hover.index === null) return null;

    if (hover.kind === "input") {
      const utxo = tx.inputs[hover.index];
      if (!utxo) return null;
      const base = `This input is spending an earlier output (UTXO) of ${satsToBtc(
        utxo.value
      )} BTC locked to ${utxo.address ?? "an unknown address"}.`;
      const tech = `Technically, this input references output #${
        utxo.vout
      } of transaction ${utxo.txid} and provides a script that proves ownership so it can be spent. Script type: ${formatScriptType(
        utxo.scriptType
      )}.`;
      return mode === "beginner" ? base : `${base} ${tech}`;
    }

    const utxo = tx.outputs[hover.index];
    if (!utxo) return null;
    const isChange = tx.changeOutputIndex === hover.index;
    const base = `This output creates a new UTXO worth ${satsToBtc(
      utxo.value
    )} BTC locked to ${utxo.address ?? "an unknown address"}.`;
    const changeText = isChange
      ? " It is likely the change coming back to the sender's wallet."
      : "";
    const tech = ` Technically, this is output #${utxo.vout} of transaction ${
      utxo.txid
    } with script type ${formatScriptType(utxo.scriptType)}.`;
    return mode === "beginner"
      ? `${base}${changeText}`
      : `${base}${changeText}${tech}`;
  }, [hover, mode, tx]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <p className="inline-flex items-center gap-2 rounded-full bg-slate-900/60 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Live on Bitcoin Testnet · UTXO Transaction Visualizer
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Understand Bitcoin UTXO transactions visually
          </h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Paste a Bitcoin <span className="font-semibold">testnet</span>{" "}
            transaction ID, or pick a recent one. Then step through how inputs
            (spent UTXOs) turn into outputs (new UTXOs), how fees are computed,
            and how the UTXO set changes.
          </p>
        </header>

        <section className="flex flex-col gap-4 rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:p-5">
          <div className="flex-1 space-y-2">
            <label
              htmlFor="txid"
              className="flex items-center justify-between text-xs font-medium text-slate-300"
            >
              <span>Transaction ID (txid)</span>
              <span className="text-[11px] text-slate-400">
                64 hex characters · testnet only
              </span>
            </label>
            <input
              id="txid"
              value={txidInput}
              onChange={(e) => setTxidInput(e.target.value)}
              placeholder="e.g. 4b0f... (testnet txid)"
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none ring-emerald-500/40 placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2"
            />
          </div>
          <div className="flex flex-col gap-2 sm:w-64">
            <button
              type="button"
              onClick={() => handleLoadTx()}
              disabled={loadingTx || !txidInput.trim()}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-600/50"
            >
              {loadingTx ? "Loading transaction..." : "Visualize transaction"}
            </button>
            <button
              type="button"
              disabled={loadingSamples}
              onClick={() => {
                if (samples[0]) {
                  setTxidInput(samples[0]);
                  void handleLoadTx(samples[0]);
                }
              }}
              className="inline-flex items-center justify-between rounded-lg border border-dashed border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 transition hover:border-emerald-500/60 hover:bg-slate-900"
            >
              <span>
                {loadingSamples
                  ? "Loading recent testnet tx…"
                  : samples[0]
                  ? "Use a recent testnet transaction"
                  : "Try a recent testnet transaction (if available)"}
              </span>
              {samples[0] && (
                <span className="truncate text-[10px] text-slate-400">
                  {samples[0]}
                </span>
              )}
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
              Explain this transaction
            </h2>
            <p className="max-w-xl text-xs text-slate-300 sm:text-sm">
              Step through how this transaction spends old UTXOs, creates new
              ones, and pays a fee. Use{" "}
              <span className="font-semibold text-emerald-300">
                Beginner
              </span>{" "}
              for intuition, or{" "}
              <span className="font-semibold text-emerald-300">
                Technical
              </span>{" "}
              to see more protocol detail.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center rounded-full bg-slate-950/80 p-1 text-xs ring-1 ring-slate-700">
              <button
                type="button"
                onClick={() => setMode("beginner")}
                className={`rounded-full px-3 py-1 transition ${
                  mode === "beginner"
                    ? "bg-emerald-400 text-slate-950"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Beginner
              </button>
              <button
                type="button"
                onClick={() => setMode("technical")}
                className={`rounded-full px-3 py-1 transition ${
                  mode === "technical"
                    ? "bg-emerald-400 text-slate-950"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Technical
              </button>
            </div>
            <StepControls step={step} setStep={setStep} />
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
            <p className="font-semibold">Could not load that transaction.</p>
            <p className="text-xs text-red-200">{error}</p>
          </div>
        )}

        {tx && (
          <>
            <TransactionFlow
              tx={tx}
              mode={mode}
              step={step}
              highlight={highlight}
              hover={hover}
              setHover={setHover}
            />

            <ExplanationPanel
              tx={tx}
              mode={mode}
              step={step}
              currentHoverExplanation={currentHoverExplanation}
            />

            <RawAndDecodedPanel tx={tx} />

            <UtxoSetBeforeAfter tx={tx} />
          </>
        )}

        {!tx && !loadingTx && !error && (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 px-4 py-5 text-xs text-slate-300 sm:text-sm">
            <p className="font-semibold text-slate-200">
              What you&apos;ll see here
            </p>
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li>
                Inputs on the left (UTXOs being{" "}
                <span className="font-semibold">spent</span>)
              </li>
              <li>
                The transaction in the center (where value is{" "}
                <span className="font-semibold">recombined</span>)
              </li>
              <li>
                Outputs on the right (new UTXOs being{" "}
                <span className="font-semibold">created</span>), with a{" "}
                <span className="text-emerald-300">likely change</span> output
                highlighted
              </li>
              <li>
                A clear fee breakdown:{" "}
                <code className="rounded bg-slate-900/80 px-1 py-0.5 text-[11px] text-emerald-200">
                  sum(inputs) − sum(outputs)
                </code>
              </li>
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

type StepControlsProps = {
  step: ExplainStep;
  setStep: (s: ExplainStep) => void;
};

function StepControls({ step, setStep }: StepControlsProps) {
  const steps: { id: ExplainStep; label: string }[] = [
    { id: 1, label: "UTXO basics" },
    { id: 2, label: "Inputs" },
    { id: 3, label: "Outputs" },
    { id: 4, label: "Fees" },
    { id: 5, label: "UTXO set" },
  ];

  const goPrev = () => setStep((Math.max(1, step - 1) as ExplainStep) || 1);
  const goNext = () => setStep((Math.min(5, step + 1) as ExplainStep) || 5);

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={goPrev}
        disabled={step === 1}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 text-slate-300 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ←
      </button>
      <div className="flex items-center gap-1">
        {steps.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={`flex h-7 items-center rounded-full px-3 text-[11px] transition ${
              step === s.id
                ? "bg-emerald-400 text-slate-950"
                : "bg-slate-950/70 text-slate-300 hover:bg-slate-900"
            }`}
          >
            {s.id}. {s.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={goNext}
        disabled={step === 5}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 text-slate-300 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        →
      </button>
    </div>
  );
}

type TransactionFlowProps = {
  tx: TxExplainerResponse;
  mode: Mode;
  step: ExplainStep;
  highlight: { inputs: boolean; outputs: boolean; fee: boolean };
  hover: HoverState;
  setHover: (h: HoverState) => void;
};

function TransactionFlow({
  tx,
  mode,
  step,
  highlight,
  hover,
  setHover,
}: TransactionFlowProps) {
  const feeBtc = satsToBtc(tx.fee);
  const totalInputBtc = satsToBtc(tx.totalInput);
  const totalOutputBtc = satsToBtc(tx.totalOutput);

  return (
    <section className="mt-2 grid gap-4 rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-6 md:p-5">
      {/* Inputs */}
      <div
        className={`space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 transition ${
          highlight.inputs ? "ring-2 ring-emerald-400/70" : ""
        }`}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200">Inputs</span>
          <span className="text-[11px] text-slate-400">
            UTXOs being spent ({tx.inputs.length})
          </span>
        </div>
        <div className="space-y-2">
          {tx.inputs.map((input, index) => (
            <UtxoCard
              key={`${input.txid}-${input.vout}-${index}`}
              utxo={input}
              kind="input"
              mode={mode}
              isChange={false}
              isHighlighted={highlight.inputs}
              isHovered={hover.kind === "input" && hover.index === index}
              onHoverChange={(isOver) =>
                setHover({
                  kind: isOver ? "input" : null,
                  index: isOver ? index : null,
                })
              }
            />
          ))}
          {tx.inputs.length === 0 && (
            <p className="text-xs text-slate-400">
              Coinbase or special transaction with no regular inputs.
            </p>
          )}
        </div>
      </div>

      {/* Transaction summary + flow */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              Transaction
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${
                tx.status.confirmed
                  ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/40"
                  : "bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/40"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {tx.status.confirmed ? "Confirmed" : "In mempool"}
            </span>
          </div>
          <p className="text-xs text-slate-300">
            This box represents the transaction logic that{" "}
            <span className="font-semibold">
              unlocks old UTXOs and locks value into new ones
            </span>
            .
          </p>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center gap-3 py-3">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-emerald-500/10 via-emerald-400/60 to-emerald-500/10" />
          <FlowArrow direction="in" active={step === 2 || step === 1} />
          <div className="relative z-10 flex flex-col items-center justify-center rounded-2xl bg-slate-950/90 px-4 py-3 text-center ring-1 ring-slate-700">
            <p className="text-[11px] text-slate-400">
              sum(inputs) ={" "}
              <span className="font-semibold text-slate-200">
                {totalInputBtc} BTC
              </span>
            </p>
            <p className="text-[11px] text-slate-400">
              sum(outputs) ={" "}
              <span className="font-semibold text-slate-200">
                {totalOutputBtc} BTC
              </span>
            </p>
            <p
              className={`mt-1 text-[11px] ${
                highlight.fee ? "text-emerald-300" : "text-slate-300"
              }`}
            >
              fee = sum(inputs) − sum(outputs) ={" "}
              <span className="font-semibold">{feeBtc} BTC</span>
            </p>
          </div>
          <FlowArrow direction="out" active={step === 3 || step === 1} />
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-950/70 p-2">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Tx size
            </dt>
            <dd className="text-xs text-slate-200">
              {tx.details.size} bytes · {tx.details.weight} weight
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Inputs / Outputs
            </dt>
            <dd className="text-xs text-slate-200">
              {tx.details.vinCount} inputs · {tx.details.voutCount} outputs
            </dd>
          </div>
        </dl>
      </div>

      {/* Outputs */}
      <div
        className={`space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 transition ${
          highlight.outputs ? "ring-2 ring-emerald-400/70" : ""
        }`}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200">Outputs</span>
          <span className="text-[11px] text-slate-400">
            New UTXOs created ({tx.outputs.length})
          </span>
        </div>
        <div className="space-y-2">
          {tx.outputs.map((output, index) => (
            <UtxoCard
              key={`${output.txid}-${output.vout}-${index}`}
              utxo={output}
              kind="output"
              mode={mode}
              isChange={tx.changeOutputIndex === index}
              isHighlighted={highlight.outputs}
              isHovered={hover.kind === "output" && hover.index === index}
              onHoverChange={(isOver) =>
                setHover({
                  kind: isOver ? "output" : null,
                  index: isOver ? index : null,
                })
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}

type FlowArrowProps = {
  direction: "in" | "out";
  active: boolean;
};

function FlowArrow({ direction, active }: FlowArrowProps) {
  const base =
    "relative z-10 inline-flex items-center justify-center rounded-full px-2 py-1 text-[11px] font-medium";
  if (direction === "in") {
    return (
      <div
        className={`${base} ${
          active
            ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/50"
            : "bg-slate-950/70 text-slate-400 ring-1 ring-slate-700"
        }`}
      >
        ← Value flows in from inputs
      </div>
    );
  }
  return (
    <div
      className={`${base} ${
        active
          ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/50"
          : "bg-slate-950/70 text-slate-400 ring-1 ring-slate-700"
      }`}
    >
      Value flows out to outputs →
    </div>
  );
}

type UtxoCardProps = {
  utxo: EnrichedInput | EnrichedOutput;
  kind: "input" | "output";
  mode: Mode;
  isChange: boolean;
  isHighlighted: boolean;
  isHovered: boolean;
  onHoverChange: (hover: boolean) => void;
};

function UtxoCard({
  utxo,
  kind,
  mode,
  isChange,
  isHighlighted,
  isHovered,
  onHoverChange,
}: UtxoCardProps) {
  const amountBtc = satsToBtc(utxo.value);
  const scriptLabel = formatScriptType(utxo.scriptType ?? null);

  const tags: string[] = [];
  if ("isCoinbase" in utxo && utxo.isCoinbase) {
    tags.push("Coinbase");
  }
  if (isChange && kind === "output") {
    tags.push("Likely change");
  }
  if ("spent" in utxo && kind === "output") {
    tags.push(utxo.spent ? "Already spent" : "Unspent");
  }

  const isEmphasized = isHighlighted || isHovered || isChange;

  return (
    <button
      type="button"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      className={`group w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
        isEmphasized
          ? "border-emerald-400/70 bg-slate-950 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
          : "border-slate-800 bg-slate-950/60 hover:border-emerald-400/50 hover:bg-slate-950"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] text-emerald-300">
          {amountBtc} BTC
        </p>
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-slate-200"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-1 space-y-1">
        <p className="line-clamp-1 font-mono text-[10px] text-slate-300">
          {utxo.address ?? "Address unknown (non-standard script)"}
        </p>
        <p className="text-[10px] text-slate-400">{scriptLabel}</p>
      </div>
      {mode === "technical" && (
        <p className="mt-1 line-clamp-1 font-mono text-[10px] text-slate-500">
          {kind === "input" ? "Prev" : "This"} tx:{" "}
          <span className="text-slate-300">{utxo.txid}</span> · vout #
          {utxo.vout}
        </p>
      )}
    </button>
  );
}

type ExplanationPanelProps = {
  tx: TxExplainerResponse;
  mode: Mode;
  step: ExplainStep;
  currentHoverExplanation: string | null;
};

function ExplanationPanel({
  tx,
  mode,
  step,
  currentHoverExplanation,
}: ExplanationPanelProps) {
  const paragraphs: string[] = useMemo(() => {
    const basics =
      "Bitcoin does not track account balances. Instead, it tracks discrete chunks of value called UTXOs (Unspent Transaction Outputs). Each UTXO can be spent once, and when it is spent it disappears and new UTXOs are created.";

    const inputs =
      "Inputs are references to previous UTXOs. Each input proves that it has the right to unlock a specific earlier output by providing a valid unlocking script (or witness in SegWit). Together, the inputs determine how much value is available to spend in this transaction.";

    const outputs =
      "Outputs define who can spend the bitcoins next. Each output locks a specific amount of BTC to a script (often derived from a human-readable address). Those outputs then join the global UTXO set as new pieces of spendable value.";

    const fees =
      "Any difference between the total value of inputs and the total value of outputs is the transaction fee. That leftover value is claimed by the miner who eventually includes this transaction in a block.";

    const utxoSet =
      "When this transaction is confirmed, the UTXOs listed as inputs are removed from the global UTXO set, and the outputs are added. The UTXO set is thus a constantly evolving snapshot of all spendable bitcoins in the system.";

    const techExtras =
      "Internally, the node validates that all inputs reference unspent outputs, that the scripts evaluate to true, and that sum(inputs) ≥ sum(outputs). It also enforces consensus rules such as locktime, script flags, and standardness policies.";

    const result: string[] = [];
    if (step === 1) {
      result.push(basics);
    } else if (step === 2) {
      result.push(inputs);
    } else if (step === 3) {
      result.push(outputs);
    } else if (step === 4) {
      result.push(
        `${fees} Here, the inputs sum to ${satsToBtc(
          tx.totalInput
        )} BTC, the outputs sum to ${satsToBtc(
          tx.totalOutput
        )} BTC, and the fee is ${satsToBtc(tx.fee)} BTC.`
      );
    } else if (step === 5) {
      result.push(
        `${utxoSet} For this transaction, all inputs you see on the left are removed from the UTXO set, and all outputs on the right are added.`
      );
    }

    if (mode === "technical") {
      result.push(techExtras);
    }
    return result;
  }, [mode, step, tx.fee, tx.totalInput, tx.totalOutput]);

  return (
    <section className="grid gap-4 rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-6 md:p-5">
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Step {step}:{" "}
          {step === 1 && "What is a UTXO?"}
          {step === 2 && "How inputs reference old UTXOs"}
          {step === 3 && "How outputs create new UTXOs"}
          {step === 4 && "How fees are calculated"}
          {step === 5 && "How the UTXO set is updated"}
        </h3>
        <div className="space-y-2 text-xs text-slate-200 sm:text-sm">
          {paragraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Hover explanation
        </p>
        <p className="text-[11px] text-slate-300">
          Hover over an input or output card to see a tailored explanation that
          connects this UTXO to the{" "}
          <span className="font-semibold">
            bigger story of how value moves
          </span>{" "}
          through the transaction.
        </p>
        <div className="mt-1 flex-1 rounded-lg bg-slate-950/70 p-3 text-[11px] text-slate-200">
          {currentHoverExplanation ? (
            <p>{currentHoverExplanation}</p>
          ) : (
            <p className="text-slate-500">
              Move your mouse over any{" "}
              <span className="text-emerald-300">input</span> or{" "}
              <span className="text-emerald-300">output</span> card to see a
              focused explanation here.
            </p>
          )}
        </div>
        <p className="text-[10px] text-slate-500">
          Why UTXOs? By working with discrete chunks instead of continuous
          balances, Bitcoin nodes can verify transactions locally without
          tracking every account, and users can build complex spending policies
          (multisig, time locks, scripts) directly into the UTXOs.
        </p>
      </div>
    </section>
  );
}

type RawAndDecodedPanelProps = {
  tx: TxExplainerResponse;
};

function RawAndDecodedPanel({ tx }: RawAndDecodedPanelProps) {
  return (
    <section className="grid gap-4 rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-6 md:p-5">
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Raw transaction (hex)
        </h3>
        <p className="text-xs text-slate-300">
          This is the exact byte-level encoding of the transaction as it appears
          on the Bitcoin network. Nodes parse this hex to reconstruct the
          structure you see above.
        </p>
        <div className="mt-2 max-h-56 overflow-auto rounded-lg bg-slate-950/80 p-3 text-[10px] font-mono leading-relaxed text-emerald-200">
          <code className="break-all">{tx.rawHex}</code>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Decoded fields
        </h3>
        <dl className="space-y-2 text-xs text-slate-200">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Txid</dt>
            <dd className="max-w-[70%] truncate font-mono text-[11px]">
              {tx.txid}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Version</dt>
            <dd>{tx.details.version}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Locktime</dt>
            <dd>{tx.details.locktime}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Inputs / Outputs</dt>
            <dd>
              {tx.details.vinCount} / {tx.details.voutCount}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Fee</dt>
            <dd>
              {satsToBtc(tx.fee)} BTC{" "}
              <span className="text-slate-500">
                ({tx.fee} sats, ~
                {tx.details.size > 0
                  ? Math.round(tx.fee / tx.details.size)
                  : 0}{" "}
                sat/vB)
              </span>
            </dd>
          </div>
          {tx.status.blockHeight && (
            <>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Block height</dt>
                <dd>{tx.status.blockHeight}</dd>
              </div>
              {tx.status.blockTime && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Block time</dt>
                  <dd>
                    {new Date(tx.status.blockTime * 1000).toLocaleString()}
                  </dd>
                </div>
              )}
            </>
          )}
        </dl>
        <p className="text-[11px] text-slate-400">
          In the UTXO model, there is no mutable &ldquo;account&rdquo; object
          to update. Instead, every transaction like this one is a pure
          transformation from one set of UTXOs to another, and nodes verify each
          transformation independently.
        </p>
      </div>
    </section>
  );
}

type UtxoSetBeforeAfterProps = {
  tx: TxExplainerResponse;
};

function UtxoSetBeforeAfter({ tx }: UtxoSetBeforeAfterProps) {
  return (
    <section className="mb-4 grid gap-4 rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800 md:grid-cols-2 md:gap-6 md:p-5">
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Before: UTXO set fragment
        </h3>
        <p className="text-xs text-slate-300">
          Just before this transaction is applied, the highlighted inputs exist
          in the global UTXO set as spendable coins.
        </p>
        <div className="mt-2 space-y-1 rounded-lg bg-slate-950/70 p-3 text-[11px] text-slate-200">
          {tx.inputs.length === 0 ? (
            <p className="text-slate-500">
              Coinbase or special transaction — it creates new coins instead of
              spending existing UTXOs.
            </p>
          ) : (
            tx.inputs.map((input, idx) => (
              <p
                key={`${input.txid}-${input.vout}-${idx}`}
                className="flex gap-2"
              >
                <span className="text-slate-500">
                  • {satsToBtc(input.value)} BTC
                </span>
                <span className="truncate font-mono text-slate-300">
                  {input.address ?? "Unknown script"}
                </span>
              </p>
            ))
          )}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          After: UTXO set fragment
        </h3>
        <p className="text-xs text-slate-300">
          After confirmation, the input UTXOs are removed from the set, and the
          outputs below appear as new spendable coins.
        </p>
        <div className="mt-2 space-y-1 rounded-lg bg-slate-950/70 p-3 text-[11px] text-slate-200">
          {tx.outputs.map((output, idx) => (
            <p
              key={`${output.txid}-${output.vout}-${idx}`}
              className="flex gap-2"
            >
              <span className="text-slate-500">
                • {satsToBtc(output.value)} BTC
              </span>
              <span className="truncate font-mono text-slate-300">
                {output.address ?? "Unknown script"}
              </span>
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

