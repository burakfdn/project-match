export type ActiveMode = "customer" | "provider";

export const ACTIVE_MODE_STORAGE_KEY = "project-match-mode";
export const ACTIVE_MODE_CHANGE_EVENT = "project-match-mode-change";

type ModeSource = {
  activeMode?: string | null;
  role?: string | null;
  customerEnabled: boolean;
  providerEnabled: boolean;
};

export function isActiveMode(
  value: string | null | undefined,
): value is ActiveMode {
  return value === "customer" || value === "provider";
}

export function resolveActiveMode(source: ModeSource): ActiveMode | null {
  if (source.activeMode === "customer" && source.customerEnabled) {
    return "customer";
  }

  if (source.activeMode === "provider" && source.providerEnabled) {
    return "provider";
  }

  if (typeof window !== "undefined") {
    const savedMode = localStorage.getItem(ACTIVE_MODE_STORAGE_KEY);

    if (savedMode === "customer" && source.customerEnabled) {
      return "customer";
    }

    if (savedMode === "provider" && source.providerEnabled) {
      return "provider";
    }
  }

  if (source.role === "provider" && source.providerEnabled) {
    return "provider";
  }

  if (source.role === "customer" && source.customerEnabled) {
    return "customer";
  }

  if (source.providerEnabled && !source.customerEnabled) {
    return "provider";
  }

  if (source.customerEnabled && !source.providerEnabled) {
    return "customer";
  }

  if (source.customerEnabled) {
    return "customer";
  }

  if (source.providerEnabled) {
    return "provider";
  }

  return null;
}

export function persistActiveMode(mode: ActiveMode) {
  localStorage.setItem(ACTIVE_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new Event(ACTIVE_MODE_CHANGE_EVENT));
}
