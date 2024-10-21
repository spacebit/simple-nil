import {
  type BlockTag,
  type Hex,
  type ProcessedReceipt,
  type SendMessageParams,
  addHexPrefix,
  bytesToHex,
  Faucet,
  getPublicKey,
  getShardIdFromAddress,
  hexToBytes,
  refineAddress,
  waitTillCompleted,
} from '@nilfoundation/niljs';
import { type Abi, decodeFunctionResult, encodeFunctionData } from 'viem';
import XWalletArtifacts from './abi/XWallet.json';
import type {
  Currency,
  DeployParams,
  IWallet,
  XClientConfig,
  XWalletConfig,
} from './types';
import { prepareDeployPart } from './utils/deployPart';
import { expectAllReceiptsSuccess } from './utils';
import { XClient } from './XClient';

export class XWallet implements IWallet {
  private constructor(
    readonly address: Hex,
    readonly client: XClient,
  ) {}

  static abi = XWalletArtifacts.abi as Abi;
  static code = hexToBytes(addHexPrefix(XWalletArtifacts.bytecode));

  static async init(config: XWalletConfig) {
    const client = new XClient({
      shardId: getShardIdFromAddress(config.address),
      rpc: config.rpc,
      signerOrPrivateKey: config.signerOrPrivateKey,
    });

    return new XWallet(config.address, client);
  }

  static async deploy(config: Required<XClientConfig>) {
    const pubkey =
      typeof config.signerOrPrivateKey === 'string'
        ? getPublicKey(config.signerOrPrivateKey)
        : config.signerOrPrivateKey.getPublicKey();

    const client = new XClient(config);

    const { data, address } = prepareDeployPart({
      salt: BigInt(Date.now()),
      bytecode: XWallet.code,
      abi: XWallet.abi,
      shard: config.shardId,
      args: [pubkey],
    });

    const addressHex = bytesToHex(address);

    const faucet = new Faucet(client.client);
    await faucet.withdrawToWithRetry(bytesToHex(address), 10n ** 15n);

    const messageHash = await client.sendRawMessage(
      bytesToHex(address),
      bytesToHex(data),
      true,
    );

    await waitTillCompleted(client.client, config.shardId, messageHash).then(
      expectAllReceiptsSuccess,
    );

    return XWallet.init({
      address: addressHex,
      ...config,
    });
  }

  async approve(spender: Hex, currencies: Currency[]) {
    const approveCalldata = encodeFunctionData({
      abi: XWallet.abi,
      functionName: 'approve',
      args: [spender, currencies],
    });

    return this._callWaitResult(approveCalldata);
  }

  async allowance(spender: Hex, currency: Currency) {
    const result = await this.client.call(
      {
        to: this.address,
        data: encodeFunctionData({
          abi: XWallet.abi,
          functionName: 'allowance',
          args: [spender, currency],
        }),
      },
      'latest',
    );

    const decoded = decodeFunctionResult({
      abi: XWallet.abi,
      functionName: 'allowance',
      data: result.data,
    });

    return BigInt(decoded as string);
  }

  async createCurrency(amount: bigint) {
    const createCurrencyCalldata = encodeFunctionData({
      abi: XWallet.abi,
      functionName: 'mintCurrency',
      args: [amount],
    });

    const receipts = await this._callWaitResult(createCurrencyCalldata);
    const currencyId = this.address;

    return { receipts, currencyId };
  }

  async getCurrencies(blockTagOrHash: Hex | BlockTag = 'latest') {
    return this.client.getCurrencies(this.address, blockTagOrHash);
  }

  async deployContract(params: DeployParams) {
    const deployData = {
      shard: params.shardId,
      bytecode: params.bytecode,
      abi: params.abi,
      args: params.args,
      salt: params.salt,
    };
    const { data, address } = prepareDeployPart(deployData);

    const { seqno, chainId } = await this.client.getCallParams(this.address);

    const receipts = await this.sendMessage({
      to: address,
      refundTo: this.address,
      data,
      value: params.value ?? 0n,
      deploy: true,
      feeCredit: params.feeCredit,
      seqno,
      chainId,
    });

    return {
      receipts,
      address: bytesToHex(address),
    };
  }

  async sendMessage(messageParams: SendMessageParams) {
    const hexTo = bytesToHex(refineAddress(messageParams.to));
    const hexRefundTo = bytesToHex(
      refineAddress(messageParams.refundTo ?? this.address),
    );
    const hexBounceTo = bytesToHex(
      refineAddress(messageParams.bounceTo ?? this.address),
    );
    const hexData = messageParams.data
      ? messageParams.data instanceof Uint8Array
        ? bytesToHex(messageParams.data)
        : messageParams.data
      : '0x';

    const callData = encodeFunctionData({
      abi: XWallet.abi,
      functionName: 'asyncCall',
      args: [
        hexTo,
        hexRefundTo,
        hexBounceTo,
        messageParams.feeCredit,
        !!messageParams.deploy,
        messageParams.tokens ?? [],
        messageParams.value ?? 0n,
        hexData,
      ],
    });

    return this._callWaitResult(callData);
  }

  private async _callWaitResult(
    calldata: Hex,
    isDeploy = false,
  ): Promise<ProcessedReceipt[]> {
    const messageHash = await this._callExternal(calldata, isDeploy);

    return waitTillCompleted(
      this.client.client,
      getShardIdFromAddress(this.address),
      messageHash,
    );
  }

  private async _callExternal(calldata: Hex, isDeploy = false) {
    return this.client.sendRawMessage(this.address, calldata, isDeploy);
  }
}
