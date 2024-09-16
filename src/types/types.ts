import { Hex } from '@nilfoundation/niljs';
import { Abi } from 'abitype';

/**
 * Options for initializing the XWallet.
 */
export type XWalletOptions = {
  address: Hex;
  rpc: string;
  signerPrivateKey: Hex;
  shardId: number;
};

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
