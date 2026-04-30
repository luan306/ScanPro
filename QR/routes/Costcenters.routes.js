import express from "express";
import { getConnection } from "../config/database.js";

const router = express.Router();

// POST /api/cost-centers  { name, group_id }
router.post("/", async (req, res) => {
  const { name, group_id } = req.body;
  if (!name || !group_id) return res.status(400).json({ success: false, message: "Thiếu thông tin" });
  const conn = await getConnection();
  try {
    const [r] = await conn.execute(
      "INSERT INTO cost_centers (name, group_id) VALUES (?, ?)",
      [name.trim(), group_id]
    );
    res.json({ success: true, id: r.insertId, name: name.trim() });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  } finally { conn.release(); }
});

// DELETE /api/cost-centers/:id
router.delete("/:id", async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.execute("DELETE FROM cost_centers WHERE id=?", [req.params.id]);
    res.json({ success: true, message: "Đã xóa cost center" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  } finally { conn.release(); }
});

export default router;