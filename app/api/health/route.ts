import { NextResponse } from "next/server";
export async function GET() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return NextResponse.json({app:"Shankuu Salon",status:"ok",supabaseConfigured:configured,payments:"not_configured"});
}
