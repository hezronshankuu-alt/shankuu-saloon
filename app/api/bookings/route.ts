
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const PHONE = /^[+0-9()\-\s]{7,25}$/;
const OPEN_MINUTES = 9 * 60;
const CLOSE_MINUTES = 18 * 60;

export async function POST(request: Request) {
  let body: any;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const {
    request_type,
    service_id,
    custom_service_name,
    custom_service_details,
    appointment_date,
    start_time,
    customer_name,
    customer_phone,
    notes,
  } = body ?? {};

  if (
    typeof appointment_date !== "string" ||
    typeof start_time !== "string" ||
    typeof customer_name !== "string" ||
    typeof customer_phone !== "string"
  ) {
    return NextResponse.json(
      { error: "Please complete all required fields." },
      { status: 400 }
    );
  }

  if (
    customer_name.trim().length < 2 ||
    customer_name.length > 100 ||
    !PHONE.test(customer_phone) ||
    (notes != null && typeof notes !== "string") ||
    (typeof notes === "string" && notes.length > 500)
  ) {
    return NextResponse.json(
      { error: "Please check your name, phone number and notes." },
      { status: 400 }
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(appointment_date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(start_time)
  ) {
    return NextResponse.json(
      { error: "Invalid appointment date or time." },
      { status: 400 }
    );
  }

  const chosen = new Date(`${appointment_date}T${start_time}:00+03:00`);
  const startMinutes =
    Number(start_time.slice(0, 2)) * 60 +
    Number(start_time.slice(3, 5));

  if (
    Number.isNaN(chosen.getTime()) ||
    chosen.toISOString().slice(0, 10) !== appointment_date ||
    chosen.getTime() < Date.now() - 60_000
  ) {
    return NextResponse.json(
      { error: "Please choose a valid future date and time." },
      { status: 400 }
    );
  }

  if (startMinutes < OPEN_MINUTES || startMinutes >= CLOSE_MINUTES) {
    return NextResponse.json(
      { error: "Choose a start time between 09:00 and 17:59." },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();

    // Special requests: salon must review the service and price.
    if (request_type === "custom") {
      if (
        typeof custom_service_name !== "string" ||
        custom_service_name.trim().length < 2 ||
        custom_service_name.trim().length > 150 ||
        (custom_service_details != null &&
          typeof custom_service_details !== "string") ||
        (typeof custom_service_details === "string" &&
          custom_service_details.length > 1000)
      ) {
        return NextResponse.json(
          { error: "Please describe the service you want." },
          { status: 400 }
        );
      }

      const { data, error } = await supabase.rpc(
        "create_service_request",
        {
          p_customer_name: customer_name.trim(),
          p_customer_phone: customer_phone.trim(),
          p_requested_service_name: custom_service_name.trim(),
          p_requested_service_details:
            typeof custom_service_details === "string"
              ? custom_service_details.trim()
              : "",
          p_appointment_date: appointment_date,
          p_start_time: start_time,
          p_notes: typeof notes === "string" ? notes.trim() : "",
        }
      );

      if (error) {
        console.error("Special service request failed:", error);
        return NextResponse.json(
          { error: "We could not save your service request. Please try again." },
          { status: 500 }
        );
      }

      const row = Array.isArray(data) ? data[0] : data;

      return NextResponse.json(
        {
          request_reference: row?.request_reference,
          request_type: "custom",
          status: "pending",
          deposit_due_tzs: 0,
          message:
            "Your request was received. The salon must confirm availability and price.",
        },
        { status: 201 }
      );
    }

    // Regular booking: service must exist and be active.
    if (typeof service_id !== "string" || !service_id) {
      return NextResponse.json(
        { error: "Please choose a service." },
        { status: 400 }
      );
    }

    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id,name,price_tzs,duration_minutes,active")
      .eq("id", service_id)
      .eq("active", true)
      .single();

    if (serviceError || !service) {
      console.error("Service lookup failed:", serviceError);
      return NextResponse.json(
        { error: "That service is unavailable. Please choose another." },
        { status: 400 }
      );
    }

    if (startMinutes + service.duration_minutes > CLOSE_MINUTES) {
      return NextResponse.json(
        {
          error:
            "That service would finish after closing time. Choose an earlier start.",
        },
        { status: 400 }
      );
    }

    const startIso = `${appointment_date}T${start_time}:00+03:00`;
    const endDate = new Date(
      new Date(startIso).getTime() + service.duration_minutes * 60_000
    );
    const endIso = endDate.toISOString();

    const { data, error } = await supabase.rpc("create_public_booking", {
      p_service_id: service.id,
      p_customer_name: customer_name.trim(),
      p_customer_phone: customer_phone.trim(),
      p_appointment_date: appointment_date,
      p_start_time: start_time,
      p_start_at: startIso,
      p_end_at: endIso,
      p_notes: typeof notes === "string" ? notes.trim() : "",
    });

    if (error) {
      console.error("Booking creation failed:", error);

      const message = error.message.toLowerCase().includes("slot_unavailable")
        ? "That time is no longer available. Please choose another time."
        : "We could not save this booking. Please try again.";

      return NextResponse.json({ error: message }, { status: 409 });
    }

    const row = Array.isArray(data) ? data[0] : data;

    return NextResponse.json(
      {
        booking_reference: row.booking_reference,
        request_type: "booking",
        status: "pending",
        deposit_due_tzs: Math.ceil(Number(service.price_tzs) / 2),
        payment_status: "unpaid",
        message: "Request received; wait for salon confirmation.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Booking API error:", error);

    return NextResponse.json(
      { error: "Booking service failed. Please try again." },
      { status: 503 }
    );
  }
}
