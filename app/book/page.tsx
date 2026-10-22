
import { createClient } from "@/lib/supabase/server";
import BookingForm from "./booking-form";

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const params = await searchParams;

  let services: {
    id: string;
    name: string;
    price_tzs: number;
    duration_minutes: number;
  }[] = [];

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("services")
      .select("id,name,price_tzs,duration_minutes")
      .eq("active", true)
      .order("sort_order");

    if (error) {
      console.error("Could not load salon services:", error);
    } else if (data) {
      services = data;
    }
  } catch (error) {
    console.error("Could not load salon services:", error);
  }

  return (
    <main className="wrap">
      <header className="topbar">
        <a className="brand" href="/">
          SHANKUU <span>SALON</span>
        </a>
        <a href="/">← Back to home</a>
      </header>

      <section className="section">
        <p className="eyebrow" style={{ color: "#98702d" }}>
          Your appointment
        </p>

        <h1 style={{ fontFamily: "Playfair Display,serif" }}>
          Book Shankuu Salon
        </h1>

        <p className="muted">
          We are open 9:00 AM–6:00 PM. Your booking starts as a request;
          the salon confirms it after checking availability.
        </p>

        <BookingForm
          services={services}
          preferredService={params.service || ""}
        />
      </section>

      <footer className="footer">
        Shankuu Salon · Dodoma, Tanzania
      </footer>
    </main>
  );
}
