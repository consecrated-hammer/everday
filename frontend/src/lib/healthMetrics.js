export const GetConsumedCalories = (totals) =>
  Number(totals?.TotalCalories ?? totals?.NetCalories ?? 0);

export const GetAdjustedCalorieTarget = (targets, log) => {
  const baseTarget = Number(targets?.DailyCalorieTarget ?? 0);
  if (!baseTarget) return 0;

  const steps = Number(log?.Steps ?? 0);
  const stepFactor = Number(log?.StepKcalFactorOverride ?? targets?.StepKcalFactor ?? 0);
  const adjustment = steps > 0 && stepFactor > 0 ? steps * stepFactor : 0;

  return Math.max(0, Math.round(baseTarget + adjustment));
};
