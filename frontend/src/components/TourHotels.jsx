import { useState } from "react";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { useToast } from "../context/toastStore";
import { useApi } from "../hooks/useApi";
import StatusBadge from "./ui/StatusBadge";
import ConfirmDialog from "./ui/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "./ui/States";
import HotelFormModal from "./forms/HotelFormModal";
import { HOTEL_STATUS } from "../utils/labels";
import { formatDate } from "../utils/date";

// The tour's hotel bookings in check-in order (as the API returns them).
function TourHotels({ tourId }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => apiClient.get(`/tours/${tourId}/hotels`), `tour-hotels-${tourId}`);
  const [form, setForm] = useState(null); // null | { hotel }
  const [deleting, setDeleting] = useState(null);
  const hotels = data?.data || [];

  return (
    <section className="card">
      <div className="section-head">
        <h2>Oteller</h2>
        {can("hotels.create") && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setForm({})}>
            + Otel Ekle
          </button>
        )}
      </div>

      {loading && !data ? (
        <LoadingState label="Oteller yükleniyor..." />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : hotels.length === 0 ? (
        <EmptyState title="Bu tur için henüz otel planlanmamış." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Otel</th>
                <th>Giriş – Çıkış</th>
                <th>Rezervasyon</th>
                <th>Durum</th>
                <th aria-label="İşlemler" />
              </tr>
            </thead>
            <tbody>
              {hotels.map((hotel) => (
                <tr key={hotel.id}>
                  <td className="cell-strong">
                    {hotel.hotel_name}
                    <span className="cell-sub">{[hotel.city, hotel.country].filter(Boolean).join(", ") || "-"}</span>
                  </td>
                  <td>
                    {formatDate(hotel.check_in)} – {formatDate(hotel.check_out)}
                  </td>
                  <td>{hotel.booking_reference || "-"}</td>
                  <td>
                    <StatusBadge map={HOTEL_STATUS} value={hotel.status} />
                  </td>
                  <td className="cell-actions">
                    {can("hotels.update") && (
                      <button type="button" className="btn-link" onClick={() => setForm({ hotel })}>
                        Düzenle
                      </button>
                    )}
                    {can("hotels.delete") && (
                      <button type="button" className="btn-link danger" onClick={() => setDeleting(hotel)}>
                        Sil
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <HotelFormModal
          hotel={form.hotel || null}
          tourId={tourId}
          onClose={() => setForm(null)}
          onSaved={() => {
            const created = !form.hotel;
            setForm(null);
            toast.success(created ? "Otel eklendi." : "Otel güncellendi.");
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Oteli sil"
          message={`${deleting.hotel_name} rezervasyonu, odaları ve oda atamaları silinecek.`}
          onConfirm={async () => {
            await apiClient.delete(`/hotels/${deleting.id}`);
            toast.success("Otel silindi.");
            reload();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}

export default TourHotels;
