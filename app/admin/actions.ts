
"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: owner } = await supabase
    .from("salon_owners")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner) redirect("/admin/login?error=not_owner");

  return supabase;
}

export async function updateBookingStatus(formData: FormData) {
  const supabase = await requireOwner();
  const id = String(formData.get("booking_id") || "");
  const status = String(formData.get("status") || "");

  if (!id || !["confirmed", "cancelled", "completed"].includes(status)) {
    return;
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error("Imeshindikana kubadilisha hali ya booking.");

  revalidatePath("/admin");
}

export async function recordDeposit(formData: FormData) {
  const supabase = await requireOwner();
  const id = String(formData.get("booking_id") || "");
  const raw = Number(formData.get("amount"));

  if (!id || !Number.isFinite(raw) || raw <= 0) return;

  const { data: booking } = await supabase
    .from("bookings")
    .select("price_tzs,deposit_paid_tzs")
    .eq("id", id)
    .single();

  if (!booking) return;

  const amount = Math.min(
    Math.round(raw),
    Number(booking.price_tzs) - Number(booking.deposit_paid_tzs)
  );

  if (amount <= 0) return;

  const { error } = await supabase
    .from("bookings")
    .update({
      deposit_paid_tzs: Number(booking.deposit_paid_tzs) + amount,
    })
    .eq("id", id);

  if (error) throw new Error("Imeshindikana kuhifadhi malipo.");

  revalidatePath("/admin");
}

export async function updateServiceRequest(formData: FormData) {
  const supabase = await requireOwner();
  const id = String(formData.get("request_id") || "");
  const status = String(formData.get("status") || "");
  const rawPrice = String(formData.get("confirmed_price_tzs") || "").trim();

  if (!id || !["reviewed", "accepted", "declined"].includes(status)) return;

  const update: {
    status: string;
    confirmed_price_tzs?: number | null;
  } = { status };

  if (status === "accepted") {
    const price = Number(rawPrice);

    if (!rawPrice || !Number.isSafeInteger(price) || price <= 0) return;

    update.confirmed_price_tzs = price;
  }

  const { error } = await supabase
    .from("service_requests")
    .update(update)
    .eq("id", id);

  if (error) {
    throw new Error("Imeshindikana kuhifadhi ombi la huduma maalumu.");
  }

  revalidatePath("/admin");
}

export async function uploadServiceImage(formData: FormData) {
  const supabase = await requireOwner();

  const serviceId = String(formData.get("service_id") || "");
  const file = formData.get("image");

  if (!serviceId || !(file instanceof File) || file.size === 0) {
    throw new Error("Chagua picha ya huduma kwanza.");
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Tumia picha ya JPG, PNG au WEBP.");
  }

  const maxSize = 5 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error("Picha isiwe kubwa kuliko MB 5.");
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id")
    .eq("id", serviceId)
    .maybeSingle();

  if (serviceError || !service) {
    throw new Error("Huduma haijapatikana.");
  }

  const extension = file.type === "image/jpeg"
    ? "jpg"
    : file.type === "image/png"
      ? "png"
      : "webp";

  const filePath = `${serviceId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("salon-images")
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(
      "Picha haikupakiwa. Hakikisha bucket ya salon-images inaruhusu upload kwa owner."
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from("salon-images")
    .getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("services")
    .update({ image_url: publicUrlData.publicUrl })
    .eq("id", serviceId);

  if (updateError) {
    throw new Error(
      "Picha imepakiwa lakini haikuweza kuunganishwa na huduma."
    );
  }

  revalidatePath("/admin");
  revalidatePath("/book");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
