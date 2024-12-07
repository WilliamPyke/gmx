import { t } from "@lingui/macro";
import ExchangeRouter from "abis/ExchangeRouter.json";
import { getContract } from "config/contracts";
import { NATIVE_TOKEN_ADDRESS, convertTokenAddress } from "config/tokens";
import { UI_FEE_RECEIVER_ACCOUNT } from "config/ui";
import { SetPendingDeposit } from "context/SyntheticsEvents";
import { Signer, ethers } from "ethers";
import { callContract } from "lib/contracts";
import { simulateExecuteTxn } from "../orders/simulateExecuteTxn";
import { TokensData } from "../tokens";
import { applySlippageToMinOut } from "../trade";
import { OrderMetricId } from "lib/metrics/types";
import { prepareOrderTxn } from "../orders/prepareOrderTxn";

export type CreateDepositParams = {
  account: string;
  initialLongTokenAddress: string;
  initialShortTokenAddress: string;
  longTokenSwapPath: string[];
  shortTokenSwapPath: string[];
  marketTokenAddress: string;
  longTokenAmount: bigint;
  shortTokenAmount: bigint;
  minMarketTokens: bigint;
  executionFee: bigint;
  allowedSlippage: number;
  tokensData: TokensData;
  skipSimulation?: boolean;
  metricId?: OrderMetricId;
  setPendingTxns: (txns: any) => void;
  setPendingDeposit: SetPendingDeposit;
};

export async function createDepositTxn(chainId: number, signer: Signer, p: CreateDepositParams) {
  const contract = new ethers.Contract(getContract(chainId, "ExchangeRouter"), ExchangeRouter.abi, signer);
  const depositVaultAddress = getContract(chainId, "DepositVault");

  const isNativeLongDeposit = Boolean(
    p.initialLongTokenAddress === NATIVE_TOKEN_ADDRESS && p.longTokenAmount != undefined && p.longTokenAmount > 0
  );
  const isNativeShortDeposit = Boolean(
    p.initialShortTokenAddress === NATIVE_TOKEN_ADDRESS && p.shortTokenAmount != undefined && p.shortTokenAmount > 0
  );

  let wntDeposit = 0n;

  if (isNativeLongDeposit) {
    wntDeposit = wntDeposit + p.longTokenAmount!;
  }

  if (isNativeShortDeposit) {
    wntDeposit = wntDeposit + p.shortTokenAmount!;
  }

  const shouldUnwrapNativeToken = isNativeLongDeposit || isNativeShortDeposit;

  const wntAmount = p.executionFee + wntDeposit;

  const initialLongTokenAddress = convertTokenAddress(chainId, p.initialLongTokenAddress, "wrapped");
  const initialShortTokenAddress = convertTokenAddress(chainId, p.initialShortTokenAddress, "wrapped");

  const minMarketTokens = applySlippageToMinOut(p.allowedSlippage, p.minMarketTokens);

  const multicall = [
    { method: "sendWnt", params: [depositVaultAddress, wntAmount] },

    !isNativeLongDeposit && p.longTokenAmount > 0
      ? { method: "sendTokens", params: [p.initialLongTokenAddress, depositVaultAddress, p.longTokenAmount] }
      : undefined,

    !isNativeShortDeposit && p.shortTokenAmount > 0
      ? { method: "sendTokens", params: [p.initialShortTokenAddress, depositVaultAddress, p.shortTokenAmount] }
      : undefined,

    {
      method: "createDeposit",
      params: [
        {
          receiver: p.account,
          callbackContract: ethers.ZeroAddress,
          market: p.marketTokenAddress,
          initialLongToken: initialLongTokenAddress,
          initialShortToken: initialShortTokenAddress,
          longTokenSwapPath: p.longTokenSwapPath,
          shortTokenSwapPath: p.shortTokenSwapPath,
          minMarketTokens: minMarketTokens,
          shouldUnwrapNativeToken: shouldUnwrapNativeToken,
          executionFee: p.executionFee,
          callbackGasLimit: 0n,
          uiFeeReceiver: UI_FEE_RECEIVER_ACCOUNT ?? ethers.ZeroAddress,
        },
      ],
    },
  ];

  const encodedPayload = multicall
    .filter(Boolean)
    .map((call) => contract.interface.encodeFunctionData(call!.method, call!.params));

  const simulationPromise = !p.skipSimulation
    ? simulateExecuteTxn(chainId, {
        account: p.account,
        primaryPriceOverrides: {},
        tokensData: p.tokensData,
        createMulticallPayload: encodedPayload,
        method: "simulateExecuteLatestDeposit",
        errorTitle: t`Deposit error.`,
        value: wntAmount,
        metricId: p.metricId,
      })
    : undefined;

  const { gasLimit, gasPriceData } = await prepareOrderTxn(
    chainId,
    contract,
    "multicall",
    [encodedPayload],
    wntAmount,
    undefined,
    simulationPromise,
    p.metricId
  );

  return callContract(chainId, contract, "multicall", [encodedPayload], {
    value: wntAmount,
    hideSentMsg: true,
    hideSuccessMsg: true,
    metricId: p.metricId,
    gasLimit,
    gasPriceData,
    setPendingTxns: p.setPendingTxns,
  }).then(() => {
    p.setPendingDeposit({
      account: p.account,
      marketAddress: p.marketTokenAddress,
      initialLongTokenAddress,
      initialShortTokenAddress,
      longTokenSwapPath: p.longTokenSwapPath,
      shortTokenSwapPath: p.shortTokenSwapPath,
      initialLongTokenAmount: p.longTokenAmount,
      initialShortTokenAmount: p.shortTokenAmount,
      minMarketTokens: minMarketTokens,
      shouldUnwrapNativeToken,
      isGlvDeposit: false,
    });
  });
}