const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { mapDbError } = require("../utils/dbErrors");
const { requireField, requireEnum } = require("../utils/validate");

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const UPDATE_STATUSES = ["DRAFT", "ARCHIVED"];

// PUBLISHED durumu normal PATCH üzerinden verilemez.
// Yayınlama yalnızca publishAnnouncement() üzerinden yapılır.
const UPDATABLE_FIELDS = [
  "title",
  "content",
  "priority",
  "status",
  "expires_at",
];

function validateInput(body, { partial = false } = {}) {
  if (!partial || body.title !== undefined) {
    requireField(body, "title");
  }

  if (!partial || body.content !== undefined) {
    requireField(body, "content");
  }

  requireEnum(body.priority, PRIORITIES, "priority");
  requireEnum(body.status, STATUSES, "status");
}

async function listAnnouncementsForTour(tourId) {
  const result = await pool.query(
    `SELECT *
     FROM announcements
     WHERE tour_id = $1
     ORDER BY created_at DESC`,
    [tourId]
  );

  return result.rows;
}

async function getAnnouncementById(id) {
  const result = await pool.query(
    `SELECT *
     FROM announcements
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new AppError(
      404,
      "ANNOUNCEMENT_NOT_FOUND",
      "Duyuru bulunamadı."
    );
  }

  return result.rows[0];
}

async function createAnnouncement(tourId, userId, body) {
  validateInput(body);

  try {
    const result = await pool.query(
      `INSERT INTO announcements (
         tour_id,
         title,
         content,
         priority,
         status,
         expires_at,
         created_by
       )
       VALUES (
         $1,
         $2,
         $3,
         COALESCE($4, 'NORMAL'),
         COALESCE($5, 'DRAFT'),
         $6,
         $7
       )
       RETURNING *`,
      [
        tourId,
        body.title,
        body.content,
        body.priority,
        body.status,
        body.expires_at || null,
        userId,
      ]
    );

    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

async function updateAnnouncement(id, body) {
  await getAnnouncementById(id);

  validateInput(body, { partial: true });

  // Normal PATCH üzerinden PUBLISHED yapılamaz.
  // Yayınlama için /publish endpoint'i kullanılmalıdır.
  if (
    body.status !== undefined &&
    !UPDATE_STATUSES.includes(body.status)
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Güncelleme sırasında status yalnızca DRAFT veya ARCHIVED olabilir. Yayınlama /publish endpoint'i üzerinden yapılmalıdır."
    );
  }

  const fields = [];
  const values = [];
  let i = 1;

  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) {
      fields.push(`${field} = $${i}`);
      values.push(body[field]);
      i++;
    }
  }

  if (fields.length === 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Güncellenecek en az bir alan gerekli."
    );
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");

  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE announcements
       SET ${fields.join(", ")}
       WHERE id = $${i}
       RETURNING *`,
      values
    );

    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

async function deleteAnnouncement(id) {
  await getAnnouncementById(id);

  await pool.query(
    "DELETE FROM announcements WHERE id = $1",
    [id]
  );
}

async function publishAnnouncement(id) {
  const announcement = await getAnnouncementById(id);

  if (announcement.status === "PUBLISHED") {
    return announcement;
  }

  if (announcement.status === "ARCHIVED") {
    throw new AppError(
      409,
      "ANNOUNCEMENT_ARCHIVED",
      "Arşivlenmiş bir duyuru yayınlanamaz."
    );
  }

  try {
    const result = await pool.query(
      `UPDATE announcements
       SET status = 'PUBLISHED',
           published_at = COALESCE(
             published_at,
             CURRENT_TIMESTAMP
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return result.rows[0];
  } catch (error) {
    mapDbError(error);
  }
}

// Duyuruyu yalnızca gerçekten erişebilen kullanıcı/katılımcı
// okundu olarak işaretleyebilir.
//
// Ayrıca yalnızca PUBLISHED duyurular okunabilir.
// DRAFT veya ARCHIVED duyurular burada 404 döner.
async function markAnnouncementRead(userId, announcementId) {
  const scope = await pool.query(
    `SELECT
       a.id,
       a.tour_id,
       a.status,
       t.company_id
     FROM announcements a
     JOIN tours t ON t.id = a.tour_id
     WHERE a.id = $1`,
    [announcementId]
  );

  if (
    scope.rows.length === 0 ||
    scope.rows[0].status !== "PUBLISHED"
  ) {
    throw new AppError(
      404,
      "ANNOUNCEMENT_NOT_FOUND",
      "Duyuru bulunamadı."
    );
  }

  const {
    tour_id: tourId,
    company_id: companyId,
  } = scope.rows[0];

  // Önce katılımcı kimliğiyle erişim kontrolü.
  const participant = await pool.query(
    `SELECT tp.participant_id
     FROM tour_participants tp
     JOIN participants p
       ON p.id = tp.participant_id
     WHERE p.user_id = $1
       AND tp.tour_id = $2`,
    [userId, tourId]
  );

  if (participant.rows.length > 0) {
    await pool.query(
      `INSERT INTO announcement_reads (
         announcement_id,
         participant_id
       )
       VALUES ($1, $2)
       ON CONFLICT (
         announcement_id,
         participant_id
       ) WHERE participant_id IS NOT NULL DO NOTHING`,
      [
        announcementId,
        participant.rows[0].participant_id,
      ]
    );

    return {
      announcementId,
      readAs: "participant",
    };
  }

  // Katılımcı değilse şirket personeli olarak kontrol et.
  const staff = await pool.query(
    `SELECT 1
     FROM company_users
     WHERE user_id = $1
       AND company_id = $2
       AND status = 'ACTIVE'`,
    [userId, companyId]
  );

  if (staff.rows.length > 0) {
    await pool.query(
      `INSERT INTO announcement_reads (
         announcement_id,
         user_id
       )
       VALUES ($1, $2)
       ON CONFLICT (
         announcement_id,
         user_id
       ) WHERE user_id IS NOT NULL DO NOTHING`,
      [announcementId, userId]
    );

    return {
      announcementId,
      readAs: "user",
    };
  }

  throw new AppError(
    404,
    "ANNOUNCEMENT_NOT_FOUND",
    "Duyuru bulunamadı."
  );
}

// Kullanıcının iki farklı kimliği olabilir:
//
// 1. Şirket personeli
// 2. Tur katılımcısı
//
// Bu nedenle iki scope'u UNION ile birleştiriyoruz.
async function listUnreadAnnouncements(userId) {
  const result = await pool.query(
    `SELECT
       a.*,
       'company' AS scope
     FROM announcements a
     JOIN tours t
       ON t.id = a.tour_id
     JOIN company_users cu
       ON cu.company_id = t.company_id
      AND cu.status = 'ACTIVE'
     WHERE cu.user_id = $1
       AND a.status = 'PUBLISHED'
       AND NOT EXISTS (
         SELECT 1
         FROM announcement_reads ar
         WHERE ar.announcement_id = a.id
           AND ar.user_id = $1
       )

     UNION

     SELECT
       a.*,
       'participant' AS scope
     FROM announcements a
     JOIN tour_participants tp
       ON tp.tour_id = a.tour_id
     JOIN participants p
       ON p.id = tp.participant_id
      AND p.user_id = $1
     WHERE a.status = 'PUBLISHED'
       AND NOT EXISTS (
         SELECT 1
         FROM announcement_reads ar
         WHERE ar.announcement_id = a.id
           AND ar.participant_id = p.id
       )

     ORDER BY published_at DESC NULLS LAST`,
    [userId]
  );

  return result.rows;
}

module.exports = {
  listAnnouncementsForTour,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  markAnnouncementRead,
  listUnreadAnnouncements,
};
