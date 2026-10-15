import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="page">
      <div className="card state">
        <p className="state-title">Sayfa bulunamadı</p>
        <p>Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.</p>
        <Link className="btn" to="/dashboard">
          Dashboard'a dön
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
