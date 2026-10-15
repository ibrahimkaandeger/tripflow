import { useTourOptions } from "../../hooks/useTourOptions";
import { formatDate } from "../../utils/date";

// <select> of the company's tours. With `allowAll` the empty option
// means "no filter" (list toolbars); otherwise it's a required choice.
function TourSelect({ id, value, onChange, allowAll = false, disabled = false }) {
  const { tours, loading, error } = useTourOptions();

  return (
    <select
      id={id}
      className="select"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled || loading}
    >
      <option value="">{loading ? "Yükleniyor..." : error ? "Turlar yüklenemedi" : allowAll ? "Tüm turlar" : "Tur seçin"}</option>
      {tours.map((tour) => (
        <option key={tour.id} value={String(tour.id)}>
          {tour.title} ({formatDate(tour.start_date)})
        </option>
      ))}
    </select>
  );
}

export default TourSelect;
