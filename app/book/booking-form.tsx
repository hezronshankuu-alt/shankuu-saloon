"use client";

import { useMemo, useState } from "react";
import { tzs } from "@/lib/format";

type Service = {
  id: string;
  name: string;
  price_tzs: number;
  duration_minutes: number;
};

type Result = {
  booking_reference?: string;
  request_reference?: string;
  request_type?: string;
  status: string;
  message?: string;
};

const MPESA_PAY_NUMBER = "352174258";
const MPESA_RECEIVER = "SHANKUU SALOON";
const WHATSAPP_NUMBER = "255627528159";
const WHATSAPP_DISPLAY_NUMBER = "0627528159";

export default function BookingForm({
  services,
  preferredService,
}: {
  services: Service[];
  preferredService: string;
}) {
  const [serviceId, setServiceId] = useState(
    services.some((s) => s.id === preferredService)
      ? preferredService
      : services[0]?.id || "custom"
  );

  const [customName, setCustomName] = useState("");
  const [customDetails, setCustomDetails] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const isCustom = serviceId === "custom";

  const service = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId]
  );

  const minDate = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10);

  const fullPrice = service?.price_tzs ?? 0;

  const whatsappMessage = [
    "SHANKUU SALON - UTHIBITISHO WA MALIPO",
    "",
    `Jina: ${name}`,
    `Simu: ${phone}`,
    `Booking reference: ${result?.booking_reference || "Haijatolewa"}`,
    `Huduma: ${service?.name || "Haijatajwa"}`,
    `Tarehe: ${date}`,
    `Muda: ${time}`,
    `Kiasi kilicholipwa: ${tzs(fullPrice)}`,
    "",
    "Nimetuma malipo ya huduma yangu. Nimeambatisha screenshot ya muamala kwa ajili ya uhakiki.",
  ].join("\n");

  const whatsappUrl =
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      whatsappMessage
    )}`;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);

    try {
      const payload = {
        request_type: isCustom ? "custom" : "booking",
        ...(isCustom
          ? {
              custom_service_name: customName.trim(),
              custom_service_details: customDetails.trim(),
            }
          : { service_id: serviceId }),
        appointment_date: date,
        start_time: time,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        notes: notes.trim(),
      };

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not submit your request.");
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setResult(null);
    setError("");
    setName("");
    setPhone("");
    setNotes("");
    setCustomName("");
    setCustomDetails("");
    setDate("");
    setTime("09:00");
  }

  if (result) {
    const customRequest =
      result.request_type === "custom" || !!result.request_reference;

    return (
      <div className="panel">
        <div className="notice">
          <strong>
            {customRequest
              ? "Custom service request received!"
              : "Booking request received!"}
          </strong>
          <br />
          Reference:{" "}
          {customRequest
            ? result.request_reference
            : result.booking_reference}
        </div>

        {customRequest ? (
          <>
            <h2>Price confirmation</h2>
            <p>
              Your request has been received. Shankuu Salon will review your
              requested service and confirm the price and availability.
            </p>
            <p className="muted">
              Please wait for the salon to confirm your final price before
              making payment.
            </p>
          </>
        ) : (
          <>
            <h2>Full payment — 100%</h2>
            <p>
              Thank you for booking with Shankuu Salon. Please pay the full
              service price shown below using the M-Pesa Lipa Namba.
            </p>

            <div
              style={{
                border: "1px solid #e7dfd0",
                borderRadius: 10,
                padding: 16,
                margin: "16px 0",
              }}
            >
              <p className="muted" style={{ marginBottom: 4 }}>
                Service
              </p>
              <strong>{service?.name}</strong>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  marginTop: 14,
                }}
              >
                <span>Total to pay (100%)</span>
                <strong className="price">{tzs(fullPrice)}</strong>
              </div>
            </div>

            <div
              className="notice"
              style={{
                padding: 16,
                borderRadius: 10,
                background: "#f8f1e5",
                color: "#4a3820",
              }}
            >
              <h3 style={{ marginTop: 0 }}>M-Pesa Lipa Namba</h3>
              <p style={{ marginBottom: 5 }}>Business number</p>
              <h2 style={{ margin: "0 0 10px" }}>
                {MPESA_PAY_NUMBER}
              </h2>

              <p style={{ marginBottom: 5 }}>Recipient name</p>
              <strong>{MPESA_RECEIVER}</strong>

              <p style={{ marginTop: 12, marginBottom: 0 }}>
                Confirm the recipient name and amount on your M-Pesa screen
                before completing the payment.
              </p>
            </div>

            <h3>After paying</h3>
            <ol>
              <li>Complete the M-Pesa payment.</li>
              <li>Save a screenshot of the successful transaction.</li>
              <li>
                Press the WhatsApp button and attach the screenshot yourself.
              </li>
            </ol>

            <div
              style={{
                border: "1px solid #e7dfd0",
                borderRadius: 10,
                padding: 16,
                marginTop: 16,
                textAlign: "center",
              }}
            >
              <p style={{ margin: "0 0 6px" }}>
                <strong>WhatsApp number</strong>
              </p>

              <h2 style={{ margin: "0 0 12px" }}>
                {WHATSAPP_DISPLAY_NUMBER}
              </h2>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gold"
                style={{
                  display: "block",
                  textAlign: "center",
                  textDecoration: "none",
                  padding: "13px 16px",
                  borderRadius: 8,
                }}
              >
                Send payment screenshot on WhatsApp
              </a>
            </div>

            <p className="small" style={{ marginTop: 12 }}>
              Your payment has not been automatically verified. The salon
              must check your transaction before confirming payment. Never
              share your M-Pesa PIN or password.
            </p>
          </>
        )}

        <button
          className="secondary"
          onClick={resetForm}
          style={{ marginTop: 16 }}
        >
          Make another request
        </button>
      </div>
    );
  }

  return (
    <div className="booking-layout">
      <form className="panel form" onSubmit={submit}>
        <div
          className="notice"
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            background: "#f8f1e5",
            color: "#4a3820",
          }}
        >
          <strong>PLEASE NOTE</strong>
          <p style={{ margin: "6px 0 0" }}>
            All listed prices include braiding hair extensions (rasta).
            Hair washing is available for an additional TZS 5,000.
          </p>
        </div>

        <div className="field">
          <label htmlFor="service">Choose a service</label>
          <select
            id="service"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            required
          >
            {services.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name} — {tzs(s.price_tzs)}
              </option>
            ))}
            <option value="custom">
              Other service — price to be confirmed
            </option>
          </select>
        </div>

        {isCustom && (
          <>
            <div className="field">
              <label htmlFor="customName">Name of requested service</label>
              <input
                id="customName"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                maxLength={150}
                required
                placeholder="Enter the hairstyle or service"
              />
            </div>

            <div className="field">
              <label htmlFor="customDetails">
                Describe the style you want
              </label>
              <textarea
                id="customDetails"
                value={customDetails}
                onChange={(e) => setCustomDetails(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Length, size, colour, hair type or other details"
              />
            </div>

            <p className="small">
              The salon will confirm the price and availability before
              accepting your request. Do not pay until the final price is
              agreed.
            </p>
          </>
        )}

        <div className="two-col">
          <div className="field">
            <label htmlFor="date">Appointment date</label>
            <input
              id="date"
              type="date"
              min={minDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="time">Start time</label>
            <select
              id="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            >
              {[
                "09:00",
                "10:00",
                "11:00",
                "12:00",
                "13:00",
                "14:00",
                "15:00",
                "16:00",
                "17:00",
              ].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="name">Your full name</label>
          <input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
            placeholder="Full name"
          />
        </div>

        <div className="field">
          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={25}
            required
            placeholder="e.g. 07XX XXX XXX"
          />
        </div>

        <div className="field">
          <label htmlFor="notes">Additional notes (optional)</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Any other information for the salon"
          />
        </div>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        <button className="gold" disabled={busy}>
          {busy ? "Sending request…" : "Submit booking request"}
        </button>

        <p className="small">
          Your booking request must be reviewed by the salon. Payment is
          checked separately and is not automatically verified by this website.
        </p>
      </form>

      <aside className="panel">
        <p className="eyebrow" style={{ color: "#98702d" }}>
          Booking summary
        </p>

        <h2>
          {isCustom
            ? customName || "Other service"
            : service?.name || "Choose a service"}
        </h2>

        {isCustom ? (
          <>
            <p className="muted">
              Price: to be confirmed by Shankuu Salon.
            </p>
            <p className="small">
              The salon will confirm the final price before payment.
            </p>
          </>
        ) : (
          <>
            <p className="muted">
              Approximate duration:{" "}
              {service
                ? `${Math.round(
                    (service.duration_minutes / 60) * 10
                  ) / 10} hours`
                : "—"}
            </p>

            <hr
              style={{
                border: 0,
                borderTop: "1px solid #e7dfd0",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span>Total service price (100%)</span>
              <strong className="price">
                {service ? tzs(service.price_tzs) : "—"}
              </strong>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 12,
                background: "#f8f1e5",
                borderRadius: 8,
              }}
            >
              <strong>M-Pesa Lipa Namba</strong>
              <h2 style={{ margin: "6px 0" }}>{MPESA_PAY_NUMBER}</h2>
              <p style={{ margin: 0 }}>Name: {MPESA_RECEIVER}</p>
            </div>

            <p className="small">
              After submitting your booking request, payment instructions
              and the WhatsApp screenshot button will appear.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}