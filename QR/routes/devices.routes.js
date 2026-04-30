import express from "express";
import { getConnection } from "../config/database.js";
import { checkAdmin }    from "../middleware/admin.js";
import { checkAuth }     from "../middleware/auth.js"; // ✅ thêm checkAuth

const router = express.Router();

/* =================================================
   GET /api/devices
   ================================================= */
router.get("/", checkAuth, async (req, res) => { // ✅ thêm checkAuth
  try {
    const conn = await getConnection();
    const [rows] = await conn.execute(`
      SELECT
        d.id,
        d.name,
        d.qr_code,
        d.location,
        d.department_id,
        d.section_id,
        d.group_id,
        d.cost_center_id,
        d.is_new,
        d.added_by,
        dep.name  AS department_name,
        dt.name   AS device_type_name,
        sec.name  AS section_name,
        grp.name  AS group_name,
        cc.name   AS cost_center_name,

        CASE
          WHEN d.is_new = 1 THEN 'new'
          WHEN s.id IS NULL THEN 'Chưa quét'
          ELSE 'Đã quét'
        END AS status

      FROM devices d
      LEFT JOIN departments dep ON d.department_id = dep.id
      LEFT JOIN device_types dt  ON dt.id = d.device_type_id
      LEFT JOIN sections    sec  ON sec.id = d.section_id
      LEFT JOIN \`groups\`  grp  ON grp.id = d.group_id
      LEFT JOIN cost_centers cc  ON cc.id  = d.cost_center_id
      LEFT JOIN (
        SELECT device_id, MAX(id) AS id
        FROM scans
        GROUP BY device_id
      ) s1 ON s1.device_id = d.id
      LEFT JOIN scans s ON s.id = s1.id
    `);
    conn.release();
    res.json(rows);
  } catch (err) {
    console.error("Devices error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});


/* =================================================
   POST /api/devices — user thêm thiết bị mới
   is_new = 1 vì do user tự add
   ================================================= */
router.post("/", checkAuth, async (req, res) => { // ✅ thêm checkAuth
  try {
    const {
      qr_code,
      name,
      device_type_id,
      department_id,
      location,
      section_id     = null,
      group_id       = null,
      cost_center_id = null,
    } = req.body;

    // ✅ Lấy added_by từ session, không tin client gửi lên
    const added_by = req.session.user.id;

    if (!qr_code || !name) {
      return res.status(400).json({ success: false, message: "Thiếu qr_code hoặc name" });
    }

    const conn = await getConnection();

    const [exist] = await conn.execute(
      "SELECT id FROM devices WHERE qr_code=?", [qr_code]
    );

    if (exist.length > 0) {
      // ✅ Thiết bị đã tồn tại (admin đã import trước) → user cập nhật thông tin
      // is_new = 1 vì user vừa xác nhận thiết bị này
      await conn.execute(`
        UPDATE devices
        SET
          name           = ?,
          device_type_id = ?,
          department_id  = ?,
          section_id     = ?,
          group_id       = ?,
          cost_center_id = ?,
          location       = ?,
          is_new         = 1,
          added_by       = ?
        WHERE qr_code = ?
      `, [name, device_type_id, department_id, section_id, group_id,
          cost_center_id, location || null, added_by, qr_code]);

      conn.release();
      return res.json({
        success: true,
        message: "🔁 Thiết bị đã tồn tại → cập nhật & chuyển bộ phận"
      });
    }

    // ✅ Thiết bị hoàn toàn mới do user add → is_new = 1
    await conn.execute(`
      INSERT INTO devices
        (qr_code, name, device_type_id, department_id, section_id, group_id, cost_center_id, location, is_new, added_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `, [qr_code, name, device_type_id, department_id, section_id,
        group_id, cost_center_id, location || null, added_by]);

    conn.release();
    res.json({ success: true, message: "✅ Thêm thiết bị thành công" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi server: " + err.message });
  }
});


/* =================================================
   DELETE /api/devices/bulk — xóa nhiều thiết bị (chỉ admin)
   Body: { ids: [1, 2, 3, ...] }
   1 request thay vì N request → tránh 429
   ================================================= */
router.delete("/bulk", checkAdmin, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách id trống" });
    }

    // Giới hạn tối đa 500 thiết bị 1 lần để tránh query quá lớn
    if (ids.length > 500) {
      return res.status(400).json({ success: false, message: "Tối đa 500 thiết bị mỗi lần xóa" });
    }

    // Chỉ cho phép số nguyên dương
    const safeIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
    if (safeIds.length === 0) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    const placeholders = safeIds.map(() => "?").join(",");
    const conn = await getConnection();

    await conn.execute(`DELETE FROM scans   WHERE device_id IN (${placeholders})`, safeIds);
    await conn.execute(`DELETE FROM devices WHERE id        IN (${placeholders})`, safeIds);

    conn.release();
    res.json({ success: true, message: `Đã xóa ${safeIds.length} thiết bị` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =================================================
   DELETE /api/devices/:id — xóa 1 thiết bị (chỉ admin)
   ================================================= */
router.delete("/:id", checkAdmin, async (req, res) => { // ✅ checkAdmin
  try {
    const { id } = req.params;
    const conn = await getConnection();
    await conn.execute("DELETE FROM scans   WHERE device_id=?", [id]);
    await conn.execute("DELETE FROM devices WHERE id=?",        [id]);
    conn.release();
    res.json({ success: true, message: "Đã xóa thiết bị" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


/* =================================================
   DELETE /api/devices — xóa toàn bộ (chỉ admin)
   ================================================= */
router.delete("/", checkAdmin, async (req, res) => { // ✅ checkAdmin
  try {
    const conn = await getConnection();
    await conn.execute("DELETE FROM scans");
    await conn.execute("DELETE FROM devices");
    conn.release();
    res.json({ success: true, message: "Đã xóa toàn bộ thiết bị" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;