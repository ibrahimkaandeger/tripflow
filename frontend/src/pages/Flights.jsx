import { useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../services/apiClient";
import { useAuth } from "../context/authStore";
import { useToast } from "../context/toastStore";
import { useApi } from "../hooks/useApi";
import { useListFilters } from "../hooks/useListFilters";
import Field from "../components/ui/Field";
import Pagination from "../components/ui/Pagination";
import StatusBadge from "../components/ui/StatusBadge";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import TourSelect from "../components/forms/TourSelect";
import FlightFormModal from "../components/forms/FlightFormModal";
import { FLIGHT_STATUS } from "../utils/labels";
import { formatDateTime } from "../utils/date";

function Flights() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useListFilters({ status: "" });
  const { data, loading, error, reload } = useApi(
    () => apiClient.get("/flights", { params: list.params }),
    JSON.stringify(list.params)
  );
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const flights = data?.data || [];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Uçuşlar</h1>
          <p className="page-subtitle">Tüm turların uçuş planı.</p>
        </div>
        {can("flights.create") && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => setForm({})}>
              + Yeni Uçuş
            </button>
          </div>
        )}
      </header>

      <div className="toolbar">
        <Field label="Ara" className="field-grow">
          {(id) => (
            <input
              id={id}
              className="input"
              type="search"
              placeholder="Havayolu, uçuş no veya havalimanı"
              value={list.search}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          )}
        </Field>
        <Field label="Tur">{(id) => <TourSelect id={id} value={list.tour} onChange={list.setTour} allowAll />}</Field>
        <Field label="Durum">
          {(id) => (
            <select id={id} className="select" value={list.filters.status} onChange={(event) => list.setFilter("status", event.target.value)}>
              <option value="">Tümü</option>
              {Object.entries(FLIGHT_STATUS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <div className="table-wrap">
        {loading && !data ? (
          <LoadingState label="Uçuşlar yükleniyor..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : flights.length === 0 ? (
          <EmptyState
            title={list.isFiltered ? "Filtrelere uyan uçuş bulunamadı." : "Henüz uçuş eklenmemiş."}
            description={list.isFiltered ? undefined : "Uçuşlar bir tura bağlı olarak eklenir."}
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Uçuş</th>
                <th>Tur</th>
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
                    <Link to={`/tours/${flight.tour_id}?tab=flights`}>{flight.tour_title}</Link>
                  </td>
                  <td>
                    {flight.departure_airport} → {flight.arrival_airport}
                  </td>
                  <td>{formatDateTime(flight.departure_datetime)}</td>
                  <td>{formatDateTime(flight.arrival_datetime)}</td>
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
        )}
      </div>

      <Pagination pagination={data?.pagination} onPageChange={list.setPage} unit="uçuş" />

      {form && (
        <FlightFormModal
          flight={form.flight || null}
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
    </div>
  );
}

export default Flights;
