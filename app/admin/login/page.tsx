"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  async function submit(e:React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const supabase = createClient();
      const {error} = await supabase.auth.signInWithPassword({email,password});
      if (error) throw error;
      window.location.href="/admin";
    } catch(err) { setError(err instanceof Error?err.message:"Could not sign in."); }
    finally { setBusy(false); }
  }
  return <main className="login"><a className="brand" href="/">SHANKUU <span style={{color:"#b58b3b"}}>SALON</span></a><section className="panel"><p className="eyebrow" style={{color:"#98702d"}}>Owner access</p><h1>Sign in</h1><p className="muted">Use the owner account created in Supabase Auth.</p><form className="form" onSubmit={submit}><div className="field"><label htmlFor="email">Owner email</label><input id="email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></div><div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></div>{error&&<div className="error">{error}</div>}<button disabled={busy}>{busy?"Signing in…":"Sign in securely"}</button></form></section><p className="small">Owner accounts should be created by an administrator. Public sign-up is intentionally not provided.</p></main>;
}
