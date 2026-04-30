import express from "express";
import { getConnection } from "../config/database.js";

const router = express.Router();

// GET /api/sections/:id/groups
router.get("/:id/groups", async (req, res) => {
  const conn = await getConnection();
  try {
    const [rows] = await conn.execute(
      "SELECT * FROM `groups` WHERE section_id=? ORDER BY name",
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  } finally { conn.release(); }
});

// DELETE /api/sections/:id
router.delete("/:id", async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.execute("DELETE FROM sections WHERE id=?", [req.params.id]);
    res.json({ success: true, message: "Đã xóa section" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  } finally { conn.release(); }
});

export default router;