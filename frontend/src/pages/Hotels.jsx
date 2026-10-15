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
import HotelFormModal from "../components/forms/HotelFormModal";
import { HOTEL_STATUS } from "../utils/labels";
import { formatDate } from "../utils/date";

function Hotels() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useListFilters({ status: "" });
  const { data, loading, error, reload } = useApi(
    () => apiClient.get("/hotels", { params: list.params }),
    JSON.stringify(list.params)
  );
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const hotels = data?.data || [];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Oteller</h1>
          <p className="page-subtitle">Tüm turların konaklama rezervasyonları.</p>
        </div>
        {can("hotels.create") && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => setForm({})}>
              + Yeni Otel
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
              placeholder="Otel adı, şehir veya ülke"
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
              {Object.entries(HOTEL_STATUS).map(([value, { label }]) => (
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
          <LoadingState label="Oteller yükleniyor..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : hotels.length === 0 ? (
          <EmptyState
            title={list.isFiltered ? "Filtrelere uyan otel bulunamadı." : "Henüz otel eklenmemiş."}
            description={list.isFiltered ? undefined : "Oteller bir tura bağlı olarak eklenir."}
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Otel</th>
                <th>Tur</th>
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
                    <Link to={`/tours/${hotel.tour_id}?tab=hotels`}>{hotel.tour_title}</Link>
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
        )}
      </div>

      <Pagination pagination={data?.pagination} onPageChange={list.setPage} unit="otel" />

      {form && (
        <HotelFormModal
          hotel={form.hotel || null}
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
    </div>
  );
}

export default Hotels;
