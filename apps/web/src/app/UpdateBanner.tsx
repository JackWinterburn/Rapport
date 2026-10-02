import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw } from "lucide-react";
import { Button } from "../ui";

/** Shown when a new version of the app has been downloaded. Reloading is the user's choice so no edit is lost. */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });
  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="status">
      <RefreshCw aria-hidden />
      <span>A new version of Rapport is ready.</span>
      <Button size="sm" variant="primary" onClick={() => updateServiceWorker(true)}>
        Reload
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
        Later
      </Button>
    </div>
  );
}
