import {
  Hex,
  LocalECDSAKeySigner,
  PublicClient,
  SendMessageParams,
} from '@nilfoundation/niljs';
import { Abi } from 'viem';

export interface IClient {
  call: (
    ...args: Parameters<PublicClient['call']>
  ) => Promise<ReturnType<PublicClient['call']>>;
}

export interface IWallet {
  deployContract: (params: DeployParams) => any;
  sendMessage: (params: SendMessageParams) => any;
  client: IClient;
}

export interface XClientConfig {
  shardId: number;
  rpc: string;
  signerOrPrivateKey?: LocalECDSAKeySigner | Hex;
}

/**
 * Options for initializing the XWallet.
 */
export interface XWalletConfig extends Required<XClientConfig> {
  address: Hex;
}

/**
 * Represents a currency with an ID and amount.
 */
export type Currency = {
  id: bigint;
  amount: bigint;
};

/**
 * Represents message tokens including fee credit, value, and optional tokens.
 */
export type MessageTokens = {
  feeCredit: bigint;
  value?: bigint;
  tokens?: Currency[];
};

/**
 * Parameters required for deployment.
 */
export type DeployParams = {
  bytecode: Uint8Array | Hex;
  abi: Abi;
  args: unknown[];
  salt: Uint8Array | bigint;
  shardId: number;
  feeCredit: bigint;
  value?: bigint;
};
