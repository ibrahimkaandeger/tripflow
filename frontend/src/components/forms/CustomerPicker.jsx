import { useEffect, useState } from "react";
import apiClient from "../../services/apiClient";
import { describeApiError } from "../../utils/apiError";

const SEARCH_DELAY_MS = 300;

// Search-as-you-type picker over the company's customers. `excludeIds`
// hides customers that are already on the tour.
function CustomerPicker({ id, value, onChange, excludeIds = [] }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState({ term: null, items: [], error: "" });

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        const response = await apiClient.get("/participants", {
          params: { search: term.trim() || undefined, status: "ACTIVE", limit: 20 },
        });
        if (!ignore) setResults({ term, items: response.data.data, error: "" });
      } catch (err) {
        if (!ignore) setResults({ term, items: [], error: describeApiError(err) });
      }
    }, SEARCH_DELAY_MS);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [term]);

  if (value) {
    return (
      <div className="picker-selected">
        <span>
          <strong>
            {value.first_name} {value.last_name}
          </strong>
          {value.email && <span className="muted small"> · {value.email}</span>}
        </span>
        <button type="button" className="btn-link" onClick={() => onChange(null)}>
          Değiştir
        </button>
      </div>
    );
  }

  const searching = results.term !== term;
  const items = results.items.filter((item) => !excludeIds.includes(item.id));

  return (
    <div className="picker">
      <input
        id={id}
        className="input"
        placeholder="Ad, e-posta veya telefon ile ara"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        autoComplete="off"
      />
      <div className="picker-results" role="listbox">
        {searching ? (
          <p className="picker-empty">Aranıyor...</p>
        ) : results.error ? (
          <p className="picker-empty state-error">{results.error}</p>
        ) : items.length === 0 ? (
          <p className="picker-empty">Eşleşen müşteri yok.</p>
        ) : (
          items.map((item) => (
            <button key={item.id} type="button" className="picker-item" role="option" aria-selected="false" onClick={() => onChange(item)}>
              <span className="cell-strong">
                {item.first_name} {item.last_name}
              </span>
              <span className="muted small">{item.email || item.phone || ""}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default CustomerPicker;
