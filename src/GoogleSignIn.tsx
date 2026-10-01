import { useEffect, useRef, useState } from "react";
export default function GoogleSignIn({
  onSignedIn,
}: {
  onSignedIn: () => void;
}) {
  const button = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError("");
    async function init() {
      try {
        const response = await fetch("/api/auth/config");
        if (!response.headers.get("Content-Type")?.includes("application/json"))
          throw Error(
            "Connect the Cloudflare backend to this website before signing in.",
          );
        const config = (await response.json()) as {
          clientId: string;
          nonce: string;
          error?: string;
        };
        if (!response.ok)
          throw Error(config.error || "Sign-in is unavailable.");
        let script = document.getElementById(
          "google-identity",
        ) as HTMLScriptElement | null;
        if (!(window as any).google) {
          await new Promise<void>((resolve, reject) => {
            if (!script) {
              script = document.createElement("script");
              script.id = "google-identity";
              script.src = "https://accounts.google.com/gsi/client";
              script.async = true;
              document.head.appendChild(script);
            }
            script.addEventListener("load", () => resolve(), { once: true });
            script.addEventListener(
              "error",
              () => {
                script?.remove();
                reject(Error("Google sign-in could not load. Please retry."));
              },
              { once: true },
            );
          });
        }
        if (cancelled || !button.current) return;
        const google = (window as any).google;
        google.accounts.id.initialize({
          client_id: config.clientId,
          nonce: config.nonce,
          auto_select: false,
          callback: async ({ credential }: { credential: string }) => {
            if (cancelled) return;
            setBusy(true);
            setError("");
            try {
              const r = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential }),
              });
              const d = (await r.json()) as { error?: string };
              if (!r.ok) throw Error(d.error);
              onSignedIn();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Unable to sign in.");
            } finally {
              setBusy(false);
            }
          },
        });
        button.current.innerHTML = "";
        google.accounts.id.renderButton(button.current, {
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
        });
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Unable to prepare sign-in.",
          );
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [retry]);
  return (
    <div>
      <div ref={button} />
      {busy && <p role="status">Signing in…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button className="secondary" onClick={() => setRetry((n) => n + 1)}>
            Retry sign-in
          </button>
        </div>
      )}
    </div>
  );
}
