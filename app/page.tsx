import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { tzs } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  let services: {id:string;name:string;description:string|null;price_tzs:number;duration_minutes:number}[] = [];
  try {
    const supabase = await createClient();
    const result = await supabase.from("services").select("id,name,description,price_tzs,duration_minutes").eq("active", true).order("sort_order");
    if (!result.error && result.data) services = result.data;
  } catch {}
  const fallback = [
    {id:"knotless",name:"Knotless Braids",description:"Neat, lightweight braids tailored to your style.",price_tzs:30000,duration_minutes:240},
    {id:"box",name:"Box Braids",description:"Classic braids with your preferred length and finish.",price_tzs:25000,duration_minutes:210},
    {id:"locs",name:"Butterfly Locs",description:"A textured protective style with a soft finish.",price_tzs:40000,duration_minutes:300},
    {id:"cornrows",name:"Cornrows",description:"Clean lines and a style that fits your look.",price_tzs:15000,duration_minutes:90},
    {id:"lashes",name:"Lash Installation",description:"Complete your look with a lash service.",price_tzs:15000,duration_minutes:60},
    {id:"wig",name:"Wig Installation",description:"A polished install for your next look.",price_tzs:20000,duration_minutes:90},
  ];
  const list = services.length ? services : fallback;
  return <main className="wrap">
    <header className="topbar"><Link className="brand" href="/">SHANKUU <span>SALON</span></Link><nav className="nav"><a href="#services">Services</a><Link className="button" href="/book">Book appointment</Link></nav></header>
    <section className="hero"><div><div className="eyebrow">Hair · Braids · Lashes · Dodoma</div><h1>Your beauty,<br/>your time.</h1><p>Book your next look at Shankuu Salon. Choose a service, request a time that works for you, and we’ll confirm your appointment.</p><Link className="button gold" href="/book">Book your appointment →</Link><p className="small">Open daily by appointment · 9:00 AM – 6:00 PM</p></div><div className="hero-art" aria-label="Decorative salon icon">✂</div></section>
    <section id="services" className="section"><p className="eyebrow" style={{color:"#98702d"}}>Our services</p><h2>Find your next look</h2><p className="muted">Starting prices shown below. Final pricing may vary by length, thickness and style.</p><div className="grid">{list.map((s,i)=><article className="card" key={s.id}><div className="service-icon">{["✦","〰","✧","♧","◉","◇"][i%6]}</div><h3>{s.name}</h3><p className="muted">{s.description || "Ask us about available styles and options."}</p><div className="price">{tzs(s.price_tzs)}</div><p className="small">Approx. {Math.round(s.duration_minutes/60*10)/10} hours</p><Link href={`/book?service=${encodeURIComponent(s.id)}`}>Book this service →</Link></article>)}</div></section>
    <section className="card" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:20,flexWrap:"wrap"}}><div><h2>Ready for your next style?</h2><p className="muted">Request your appointment online in a few simple steps.</p></div><Link className="button gold" href="/book">Start booking</Link></section>
    <footer className="footer">© {new Date().getFullYear()} Shankuu Salon · Dodoma, Tanzania</footer>
  </main>;
}
