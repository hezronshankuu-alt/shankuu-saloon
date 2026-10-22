
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tzs } from "@/lib/format";
import {
  recordDeposit,
  signOut,
  updateBookingStatus,
  updateServiceRequest,
  uploadServiceImage,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: owner } = await supabase
    .from("salon_owners")
    .select("user_id,display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner)
    return (
      <main className="login">
        <section className="panel">
          <h1>Owner access not enabled</h1>
          <p className="muted">
            You are signed in, but this account is not listed as a Shankuu Salon owner.
          </p>
          <form action={signOut}>
            <button>Sign out</button>
          </form>
        </section>
      </main>
    );

  const [
    { data: bookings },
    { data: serviceRequests, error: requestsError },
    { data: services, error: servicesError },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id,booking_reference,customer_name,customer_phone,appointment_date,start_time,end_time,status,price_tzs,deposit_due_tzs,deposit_paid_tzs,notes,services(name)"
      )
      .order("appointment_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(100),

    supabase
      .from("service_requests")
      .select(
        "id,request_reference,customer_name,customer_phone,requested_service_name,requested_service_details,appointment_date,start_time,notes,status,confirmed_price_tzs,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100),

    supabase
      .from("services")
      .select("id,name,price_tzs,image_url")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);

  const list = bookings || [];
  const requests = serviceRequests || [];
  const serviceList = services || [];

  const pending = list.filter((b) => b.status === "pending").length;
  const pendingRequests = requests.filter(
    (r) => r.status === "pending"
  ).length;

  const paid = list.reduce(
    (sum, b) => sum + Number(b.deposit_paid_tzs || 0),
    0
  );

  return (
    <main className="admin-shell">
      <div className="admin-head">
        <div className="wrap topbar">
          <div>
            <a className="brand" href="/">
              SHANKUU <span>SALON</span>
            </a>
            <div className="small" style={{ color: "#d7ccbb" }}>
              Owner dashboard · Dodoma
            </div>
          </div>
          <form action={signOut}>
            <button className="secondary">Sign out</button>
          </form>
        </div>
      </div>

      <div className="wrap section">
        <p className="eyebrow" style={{ color: "#98702d" }}>
          Owner dashboard
        </p>
        <h1>
          Welcome{owner.display_name ? `, ${owner.display_name}` : " back"}
        </h1>
        <p className="muted">
          Manage appointments, custom service requests, deposits and service photos.
        </p>

        <div className="stats">
          <div className="card stat">
            <span className="muted">Bookings shown</span>
            <strong>{list.length}</strong>
          </div>
          <div className="card stat">
            <span className="muted">Pending bookings</span>
            <strong>{pending}</strong>
          </div>
          <div className="card stat">
            <span className="muted">Custom requests</span>
            <strong>{requests.length}</strong>
          </div>
          <div className="card stat">
            <span className="muted">Pending requests</span>
            <strong>{pendingRequests}</strong>
          </div>
          <div className="card stat">
            <span className="muted">Deposits recorded</span>
            <strong style={{ fontSize: 18 }}>{tzs(paid)}</strong>
          </div>
          <div className="card stat">
            <span className="muted">Opening hours</span>
            <strong style={{ fontSize: 18 }}>09:00–18:00</strong>
          </div>
        </div>

        <section className="panel" style={{ marginTop: 20 }}>
          <h2>Manage Service Photos</h2>
          <p className="small">
            Choose a photo from your computer for each salon service.
            Use JPG, PNG or WEBP images up to 5 MB.
          </p>

          {servicesError ? (
            <div className="empty">
              Could not load services. Check the services table and try again.
            </div>
          ) : serviceList.length === 0 ? (
            <div className="empty">
              No active services were found.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
                marginTop: 16,
              }}
            >
              {serviceList.map((service) => (
                <div
                  key={service.id}
                  className="card"
                  style={{ padding: 14, minWidth: 0 }}
                >
                  {service.image_url ? (
                    <img
                      src={service.image_url}
                      alt={service.name}
                      style={{
                        display: "block",
                        width: "100%",
                        height: 190,
                        objectFit: "cover",
                        borderRadius: 8,
                        marginBottom: 12,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 190,
                        borderRadius: 8,
                        background: "#f1ece4",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 12,
                        color: "#756b5c",
                        textAlign: "center",
                        padding: 12,
                      }}
                    >
                      No photo uploaded yet
                    </div>
                  )}

                  <h3 style={{ marginBottom: 6 }}>{service.name}</h3>
                  <p className="small" style={{ marginTop: 0 }}>
                    {tzs(service.price_tzs)}
                  </p>

                  <form
                    action={uploadServiceImage}
                    encType="multipart/form-data"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <input
                      type="hidden"
                      name="service_id"
                      value={service.id}
                    />
                    <label className="small" htmlFor={`image-${service.id}`}>
                      Choose photo from your computer
                    </label>
                    <input
                      id={`image-${service.id}`}
                      type="file"
                      name="image"
                      accept="image/jpeg,image/png,image/webp"
                      required
                      style={{ width: "100%" }}
                    />
                    <button className="gold" type="submit">
                      Upload photo
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel" style={{ marginTop: 20 }}>
          <h2>Special Service Requests</h2>
          <p className="small">
            Review services that customers request outside the standard service
            list. Enter the agreed price before accepting.
          </p>

          {requestsError ? (
            <div className="empty">
              Could not load special requests. Check the service_requests table
              permissions and try again.
            </div>
          ) : requests.length === 0 ? (
            <div className="empty">No special service requests yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Requested service</th>
                    <th>Appointment</th>
                    <th>Agreed price (TZS)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.customer_name}</strong>
                        <br />
                        <span className="small">{r.customer_phone}</span>
                        <br />
                        <span className="small">{r.request_reference}</span>
                      </td>
                      <td>
                        <strong>{r.requested_service_name}</strong>
                        <br />
                        <span className="small">
                          {r.requested_service_details}
                        </span>
                        {r.notes && (
                          <>
                            <br />
                            <span className="small">Note: {r.notes}</span>
                          </>
                        )}
                      </td>
                      <td>
                        {r.appointment_date}
                        <br />
                        {String(r.start_time).slice(0, 5)}
                      </td>
                      <td>
                        {r.confirmed_price_tzs != null
                          ? tzs(r.confirmed_price_tzs)
                          : "Not set"}
                      </td>
                      <td>
                        <span className={`badge ${r.status}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          {["pending", "reviewed"].includes(r.status) && (
                            <>
                              <form action={updateServiceRequest}>
                                <input
                                  type="hidden"
                                  name="request_id"
                                  value={r.id}
                                />
                                <input
                                  type="hidden"
                                  name="status"
                                  value="reviewed"
                                />
                                <button className="secondary">
                                  Review
                                </button>
                              </form>

                              <form
                                action={updateServiceRequest}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 5,
                                  minWidth: 110,
                                }}
                              >
                                <input
                                  type="hidden"
                                  name="request_id"
                                  value={r.id}
                                />
                                <input
                                  type="hidden"
                                  name="status"
                                  value="accepted"
                                />
                                <input
                                  type="number"
                                  name="confirmed_price_tzs"
                                  min="1"
                                  step="1"
                                  placeholder="Price in TZS"
                                  aria-label="Agreed price in TZS"
                                  required
                                  style={{ width: 120, padding: 5 }}
                                />
                                <button className="gold">Accept</button>
                              </form>

                              <form action={updateServiceRequest}>
                                <input
                                  type="hidden"
                                  name="request_id"
                                  value={r.id}
                                />
                                <input
                                  type="hidden"
                                  name="status"
                                  value="declined"
                                />
                                <button className="secondary">
                                  Decline
                                </button>
                              </form>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel" style={{ marginTop: 20 }}>
          <h2>Appointments</h2>
          <p className="small">
            Only owner-authorized accounts can view this data. Status changes
            are saved in the database.
          </p>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Appointment</th>
                  <th>Service</th>
                  <th>Price / deposit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b: any) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.customer_name}</strong>
                      <br />
                      <span className="small">{b.customer_phone}</span>
                      <br />
                      <span className="small">{b.booking_reference}</span>
                    </td>
                    <td>
                      {b.appointment_date}
                      <br />
                      {String(b.start_time).slice(0, 5)}–
                      {String(b.end_time).slice(0, 5)}
                    </td>
                    <td>
                      {Array.isArray(b.services)
                        ? b.services[0]?.name
                        : b.services?.name || "Service"}
                    </td>
                    <td>
                      {tzs(b.price_tzs)}
                      <br />
                      <span className="small">
                        Deposit target: {tzs(b.deposit_due_tzs)}
                        <br />
                        Recorded: {tzs(b.deposit_paid_tzs)}
                      </span>
                      {Number(b.deposit_paid_tzs) <
                        Number(b.deposit_due_tzs) && (
                        <form
                          action={recordDeposit}
                          style={{
                            display: "flex",
                            gap: 5,
                            marginTop: 6,
                          }}
                        >
                          <input
                            type="hidden"
                            name="booking_id"
                            value={b.id}
                          />
                          <input
                            aria-label="Amount paid"
                            name="amount"
                            type="number"
                            min="1"
                            max={
                              Number(b.price_tzs) -
                              Number(b.deposit_paid_tzs)
                            }
                            placeholder="Amount"
                            style={{ width: 90, padding: 5 }}
                            required
                          />
                          <button className="secondary">Record</button>
                        </form>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${b.status}`}>{b.status}</span>
                    </td>
                    <td>
                      <div className="actions">
                        {b.status === "pending" && (
                          <form action={updateBookingStatus}>
                            <input
                              type="hidden"
                              name="booking_id"
                              value={b.id}
                            />
                            <input
                              type="hidden"
                              name="status"
                              value="confirmed"
                            />
                            <button className="gold">Confirm</button>
                          </form>
                        )}
                        {["pending", "confirmed"].includes(b.status) && (
                          <form action={updateBookingStatus}>
                            <input
                              type="hidden"
                              name="booking_id"
                              value={b.id}
                            />
                            <input
                              type="hidden"
                              name="status"
                              value="cancelled"
                            />
                            <button className="secondary">Cancel</button>
                          </form>
                        )}
                        {b.status === "confirmed" && (
                          <form action={updateBookingStatus}>
                            <input
                              type="hidden"
                              name="booking_id"
                              value={b.id}
                            />
                            <input
                              type="hidden"
                              name="status"
                              value="completed"
                            />
                            <button>Complete</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {list.length === 0 && (
            <div className="empty">
              No bookings yet. New customer requests will appear here.
            </div>
          )}
        </section>

        <p className="small">
          Deposit records here are manual and are not verified by a payment
          provider. Connect a gateway before treating them as automated payment
          confirmations.
        </p>
      </div>
    </main>
  );
}
