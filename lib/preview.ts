export type PreviewUser = {
    id: string;
    email: string | null;
    full_name: string | null;
    customer_enabled: boolean;
    provider_enabled: boolean;
    is_admin: boolean;
  };
  
  const PREVIEW_STORAGE_KEY =
    "project-match-preview-user";
  
  export function getPreviewUser(): PreviewUser | null {
    if (typeof window === "undefined") {
      return null;
    }
  
    const raw = localStorage.getItem(
      PREVIEW_STORAGE_KEY,
    );
  
    if (!raw) {
      return null;
    }
  
    try {
      return JSON.parse(raw) as PreviewUser;
    } catch {
      localStorage.removeItem(
        PREVIEW_STORAGE_KEY,
      );
  
      return null;
    }
  }
  
  export function setPreviewUser(
    user: PreviewUser,
  ) {
    if (typeof window === "undefined") {
      return;
    }
  
    localStorage.setItem(
      PREVIEW_STORAGE_KEY,
      JSON.stringify(user),
    );
  }
  
  export function clearPreviewUser() {
    if (typeof window === "undefined") {
      return;
    }
  
    localStorage.removeItem(
      PREVIEW_STORAGE_KEY,
    );
  
    localStorage.removeItem(
      "project-match-mode",
    );
  }
  
  export function isPreviewMode(): boolean {
    return getPreviewUser() !== null;
  }
