// Global browser type augmentations for non-standard navigator properties
// used in PWA detection logic

interface Navigator {
  /** iOS PWA standalone mode detection */
  standalone?: boolean;
  /** Brave browser detection */
  brave?: {
    isBrave: () => Promise<boolean>;
  };
}

interface FeatureFlagEvent extends CustomEvent {
  detail: {
    key: string;
    value: boolean;
  };
}

declare module 'virtual:pwa-register/react' {
  interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (
      registration: ServiceWorkerRegistration | undefined,
    ) => void;
    onRegisteredSW?: (
      swScriptUrl: string,
      registration: ServiceWorkerRegistration | undefined,
    ) => void;
    onRegisterError?: (error: Error) => void;
  }

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, React.Dispatch<React.SetStateAction<boolean>>];
    offlineReady: [boolean, React.Dispatch<React.SetStateAction<boolean>>];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
