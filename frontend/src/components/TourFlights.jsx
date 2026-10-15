import { useState } from "react";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { useToast } from "../context/toastStore";
import { useApi } from "../hooks/useApi";
import StatusBadge from "./ui/StatusBadge";
import ConfirmDialog from "./ui/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "./ui/States";
import FlightFormModal from "./forms/FlightFormModal";
import { FLIGHT_STATUS } from "../utils/labels";
import { formatDateTime } from "../utils/date";

// The tour's flights in departure order (as the API returns them).
function TourFlights({ tourId }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => apiClient.get(`/tours/${tourId}/flights`), `tour-flights-${tourId}`);
  const [form, setForm] = useState(null); // null | { flight }
  const [deleting, setDeleting] = useState(null);
  const flights = data?.data || [];

  return (
    <section className="card">
      <div className="section-head">
        <h2>Uçuşlar</h2>
        {can("flights.create") && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setForm({})}>
            + Uçuş Ekle
          </button>
        )}
      </div>

      {loading && !data ? (
        <LoadingState label="Uçuşlar yükleniyor..." />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : flights.length === 0 ? (
        <EmptyState title="Bu tur için henüz uçuş planlanmamış." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Uçuş</th>
                <th>Güzergah</th>
                <th>Kalkış</th>
                <th>Varış</th>
                <th>Durum</th>
                <th aria-label="İşlemler" />
              </tr>
            </thead>
            <tbody>
              {flights.map((flight) => (
                <tr key={flight.id}>
                  <td className="cell-strong">
                    {flight.airline} · {flight.flight_number}
                    {flight.booking_reference && <span className="cell-sub">PNR: {flight.booking_reference}</span>}
                  </td>
                  <td>
                    {flight.departure_airport} → {flight.arrival_airport}
                  </td>
                  <td>
                    {formatDateTime(flight.departure_datetime)}
                    {flight.departure_terminal && <span className="cell-sub">Terminal {flight.departure_terminal}</span>}
                  </td>
                  <td>
                    {formatDateTime(flight.arrival_datetime)}
                    {flight.arrival_terminal && <span className="cell-sub">Terminal {flight.arrival_terminal}</span>}
                  </td>
                  <td>
                    <StatusBadge map={FLIGHT_STATUS} value={flight.status} />
                  </td>
                  <td className="cell-actions">
                    {can("flights.update") && (
                      <button type="button" className="btn-link" onClick={() => setForm({ flight })}>
                        Düzenle
                      </button>
                    )}
                    {can("flights.delete") && (
                      <button type="button" className="btn-link danger" onClick={() => setDeleting(flight)}>
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
        <FlightFormModal
          flight={form.flight || null}
          tourId={tourId}
          onClose={() => setForm(null)}
          onSaved={() => {
            const created = !form.flight;
            setForm(null);
            toast.success(created ? "Uçuş eklendi." : "Uçuş güncellendi.");
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Uçuşu sil"
          message={`${deleting.airline} ${deleting.flight_number} uçuşu ve yolcu atamaları silinecek.`}
          onConfirm={async () => {
            await apiClient.delete(`/flights/${deleting.id}`);
            toast.success("Uçuş silindi.");
            reload();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}

export default TourFlights;
