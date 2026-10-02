import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { BookUser } from "lucide-react";
import { Button, Callout, Divider } from "../ui";
import { api, errorMessage, keys, queryClient } from "../lib/api";
import "./pages.css";

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.33-1.58-5.04-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.96 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: config } = useQuery({ queryKey: ["auth-config"], queryFn: api.authConfig });
  const [devError, setDevError] = useState<string | null>(null);
  const error = params.get("error");

  const devLogin = async () => {
    try {
      const user = await api.devLogin();
      queryClient.setQueryData(keys.me, user);
      navigate("/", { replace: true });
    } catch (e) {
      setDevError(errorMessage(e));
    }
  };

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__logo" aria-hidden>
          <BookUser />
        </div>
        <h1 className="login__title">Rapport</h1>
        <p className="login__tagline">Remember what matters to the people in your life.</p>

        {error && (
          <Callout tone="danger" title="Couldn't sign you in">
            {error}
          </Callout>
        )}

        <a className={`login__google ${config && !config.google ? "login__google--disabled" : ""}`} href={config?.google ? "/auth/google" : undefined} aria-disabled={config ? !config.google : undefined}>
          <GoogleMark />
          Continue with Google
        </a>
        {config && !config.google && <p className="login__note">Google sign-in isn't configured on this server yet.</p>}

        {config?.devLogin && (
          <>
            <Divider label="Local development" />
            <Button block variant="secondary" onClick={devLogin}>
              Continue as dev user
            </Button>
            {devError && <p className="login__note login__note--error">{devError}</p>}
          </>
        )}

        <p className="login__privacy">
          Your contacts stay private to your account. Conversation text you choose to log is sent to Google Gemini to suggest profile updates, and nothing is saved until you approve it.
        </p>
      </div>
    </div>
  );
}
