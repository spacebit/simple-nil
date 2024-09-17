import { Hex } from '@nilfoundation/niljs';
import {
  Abi,
  ContractConstructorArgs,
  ContractFunctionName,
  decodeFunctionResult,
  DecodeFunctionResultReturnType,
  encodeFunctionData,
  EncodeFunctionDataParameters,
} from 'viem';
import { IWallet, MessageTokens } from './types';
import { expectAllReceiptsSuccess } from './utils/receipt';

export class XContract<T extends Abi> {
  constructor(
    private abi: T,
    private wallet: IWallet,
    public address: Hex,
  ) {}

  static connect<T extends Abi>(
    wallet: IWallet,
    abi: T,
    address: Hex,
  ): XContract<T> {
    return new XContract(abi, wallet, address);
  }

  static async deploy<T extends Abi>(
    wallet: IWallet,
    artifact: { abi: T; bytecode: Hex },
    args: ContractConstructorArgs<T>,
    shardId: number,
    salt?: bigint,
  ): Promise<XContract<T>> {
    const { address, receipts } = await wallet.deployContract({
      abi: artifact.abi,
      args: args as unknown[],
      bytecode: artifact.bytecode,
      feeCredit: 5_000_000n,
      shardId,
      salt: salt ?? BigInt(Date.now()),
    });

    expectAllReceiptsSuccess(receipts);

    return new XContract(artifact.abi, wallet, address);
  }

  connect(wallet: IWallet) {
    return new XContract(this.abi, wallet, this.address);
  }

  async sendMessage<functionName extends ContractFunctionName<T>>(
    params: Omit<EncodeFunctionDataParameters<T, functionName>, 'abi'>,
    messageTokens: MessageTokens,
    expectSuccess = true,
  ) {
    const receipts = await this.wallet.sendMessage({
      to: this.address,
      feeCredit: messageTokens.feeCredit,
      value: messageTokens.value,
      tokens: messageTokens.tokens,
      data: encodeFunctionData({
        abi: this.abi as any,
        functionName: params.functionName,
        args: params.args as any,
      }),
    });

    if (expectSuccess) expectAllReceiptsSuccess(receipts);

    return receipts;
  }

  async call<functionName extends ContractFunctionName<T>>(
    params: Omit<EncodeFunctionDataParameters<T, functionName>, 'abi'>,
  ) {
    const { data } = await this.wallet.client.call(
      {
        to: this.address,
        data: encodeFunctionData({
          abi: this.abi as any,
          functionName: params.functionName,
          args: params.args as any,
        }),
      },
      'latest',
    );

    return decodeFunctionResult({
      abi: this.abi as any,
      functionName: params.functionName as any,
      data,
    }) as DecodeFunctionResultReturnType<T, functionName>;
  }
}
