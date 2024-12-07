import { Token } from "domain/tokens";

export type Position = {
  key: string;
  contractKey?: string;
  collateralToken: Token;
  indexToken: Token;
  isLong: boolean;
  size: bigint;
  collateral: bigint;
  averagePrice: bigint;
  entryFundingRate: bigint;
  cumulativeFundingRate: bigint;
  hasRealisedProfit: boolean;
  realisedPnl: bigint;
  lastIncreasedTime: number;
  hasProfit: boolean;
  delta: bigint;
  markPrice: bigint;
  fundingFee: bigint;
  collateralAfterFee: bigint;
  closingFee: bigint;
  positionFee: bigint;
  totalFees: bigint;
  pendingDelta: bigint;
  hasLowCollateral: boolean;
  deltaPercentage: bigint;
  deltaStr: string;
  deltaPercentageStr: string;
  deltaBeforeFeesStr: string;
  hasProfitAfterFees: boolean;
  pendingDeltaAfterFees: bigint;
  deltaPercentageAfterFees: bigint;
  deltaAfterFeesStr: string;
  deltaAfterFeesPercentageStr: string;
  netValue: bigint;
  leverage: bigint;
  leverageWithPnl: bigint;
  leverageStr: string;
};

export type Positions = Position[];