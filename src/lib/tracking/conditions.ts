import type { ConditionConfig } from "@/types/tracking";

export function shouldTrigger(
  condition: ConditionConfig,
  currentValue: string,
  previousValue?: string,
  currentExists?: boolean,
): boolean {
  const exists = typeof currentExists === "boolean" ? currentExists : currentValue.length > 0;

  switch (condition.operator) {
    case "changed":
      if (typeof previousValue === "undefined") {
        return false;
      }
      return currentValue !== previousValue;
    case "contains":
      return currentValue.includes(condition.value ?? "");
    case "equals":
      return currentValue === (condition.value ?? "");
    case "greater_than": {
      const current = Number(currentValue);
      const target = Number(condition.value ?? "NaN");
      return Number.isFinite(current) && Number.isFinite(target) && current > target;
    }
    case "less_than": {
      const current = Number(currentValue);
      const target = Number(condition.value ?? "NaN");
      return Number.isFinite(current) && Number.isFinite(target) && current < target;
    }
    case "exists":
      return exists;
    case "not_exists":
      return !exists;
    default:
      return false;
  }
}
