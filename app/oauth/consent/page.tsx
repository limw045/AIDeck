import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { approve, deny } from "./actions";
import { AuthShell } from "@/app/components/auth-shell";
import { Icon } from "@/app/components/symbols";

export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ authorization_id?: string }> }) {
  const authorizationId = (await searchParams).authorization_id;
  if (!authorizationId) return <AuthShell><div className="auth-welcome-icon"><Icon name="shield" size={25} /></div><h1>Missing authorization request</h1><p className="auth-description">Return to the website and try again.</p></AuthShell>;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`);
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) return <AuthShell><div className="auth-welcome-icon"><Icon name="shield" size={25} /></div><h1>Authorization request expired</h1><p className="auth-description">Return to the website and try again.</p></AuthShell>;
  if (!("authorization_id" in data)) redirect(data.redirect_url);
  return <AuthShell><div className="auth-welcome-icon"><Icon name="shield" size={25} /></div><p className="eyebrow">CONNECTED ACCESS</p><h1>Connect to {data.client.name}</h1>
    <p className="auth-description">This application wants to use your AIDeck identity. You’re signed in as <strong>{user.email}</strong>.</p>
    <div className="consent-details"><p><strong>Requested access</strong><br />{data.scope}</p><p><strong>Return address</strong><br />{data.redirect_uri}</p></div>
    <div className="actions"><form action={approve}><input type="hidden" name="authorizationId" value={authorizationId} /><button>Authorize</button></form>
      <form action={deny}><input type="hidden" name="authorizationId" value={authorizationId} /><button className="secondary">Cancel</button></form></div>
  </AuthShell>;
}

