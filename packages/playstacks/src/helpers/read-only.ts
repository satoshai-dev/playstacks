import {
  fetchCallReadOnlyFunction,
  type ClarityValue,
} from '@stacks/transactions';
import type { ResolvedNetwork } from '../network/network-config.js';

interface ReadOnlyCallWithContract {
  /** Contract identifier: "SPaddr.contractName" */
  contract: string;
  contractAddress?: never;
  contractName?: never;
  functionName: string;
  functionArgs: ClarityValue[];
  senderAddress?: string;
}

interface ReadOnlyCallWithSplit {
  contract?: never;
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  senderAddress?: string;
}

export type ReadOnlyCallOptions = ReadOnlyCallWithContract | ReadOnlyCallWithSplit;

/**
 * Call a read-only Clarity function and return the result.
 * This does not create a transaction — it reads state directly from the node.
 */
export async function callReadOnly(
  network: ResolvedNetwork,
  options: ReadOnlyCallOptions,
  defaultSenderAddress: string
): Promise<ClarityValue> {
  let contractAddress: string;
  let contractName: string;

  if ('contract' in options && options.contract) {
    const [addr, ...rest] = options.contract.split('.');
    contractAddress = addr;
    contractName = rest.join('.');
  } else {
    contractAddress = (options as ReadOnlyCallWithSplit).contractAddress;
    contractName = (options as ReadOnlyCallWithSplit).contractName;
  }

  const result = await fetchCallReadOnlyFunction({
    contractAddress,
    contractName,
    functionName: options.functionName,
    functionArgs: options.functionArgs,
    network: network.stacksNetwork,
    senderAddress: options.senderAddress ?? defaultSenderAddress,
  });

  return result;
}
