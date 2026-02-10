export type ScriptType =
  | "p2pkh"
  | "p2wpkh"
  | "p2sh"
  | "v0_p2wsh"
  | "v1_p2tr"
  | string;

export interface EnrichedInput {
  txid: string;
  vout: number;
  value: number; // sats
  address: string | null;
  scriptType: ScriptType | null;
  isCoinbase: boolean;
}

export interface EnrichedOutput {
  txid: string;
  vout: number;
  value: number; // sats
  address: string | null;
  scriptType: ScriptType | null;
  spent: boolean;
}

export interface TxStatus {
  confirmed: boolean;
  blockHeight: number | null;
  blockHash: string | null;
  blockTime: number | null;
}

export interface TxDetails {
  version: number;
  locktime: number;
  size: number;
  weight: number;
  vinCount: number;
  voutCount: number;
}

export interface TxExplainerResponse {
  txid: string;
  fee: number; // sats
  totalInput: number; // sats
  totalOutput: number; // sats
  inputs: EnrichedInput[];
  outputs: EnrichedOutput[];
  status: TxStatus;
  details: TxDetails;
  rawHex: string;
  changeOutputIndex: number | null;
}

