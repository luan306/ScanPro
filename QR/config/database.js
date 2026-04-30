import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || "localhost",
  user:               process.env.DB_USER     || "root",
  password:           process.env.DB_PASSWORD || "",
  database:           process.env.DB_NAME     || "inventory",


  connectionLimit:    40,   
  queueLimit:         500,  
  waitForConnections: true,

  // ── Timeout settings ────────────────────────────────────────
  connectTimeout:     10000,
  idleTimeout:        60000,    
  enableKeepAlive:    true,
  keepAliveInitialDelay: 0,

  charset: "utf8mb4",
  timezone: "+07:00", 
});

// ── Kiểm tra kết nối ban đầu ────────────────────────────────────
pool.getConnection()
  .then(conn => {
    console.log("✅ MySQL pool connected (limit=40, queue=500)");
    conn.release();
  })
  .catch(err => {
    console.error("❌ MySQL pool error:", err.message);

  });


setInterval(async () => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.ping();
  } catch (e) {
    console.warn("⚠️ Pool ping failed:", e.message);
  } finally {
    if (conn) conn.release();
  }
}, 5 * 60 * 1000);


setInterval(() => {
  const used      = pool.pool._allConnections.length;
  const free      = pool.pool._freeConnections.length;
  const queued    = pool.pool._connectionQueue.length;
  const limit     = pool.pool.config.connectionLimit;
  const usedPct   = Math.round((used / limit) * 100);

  if (queued > 0) {
    console.warn(`⚠️ [Pool] Connections: ${used}/${limit} (${usedPct}%) | Free: ${free} | Queued: ${queued}`);
  } else if (usedPct >= 80) {
    console.warn(`⚠️ [Pool] High usage: ${used}/${limit} (${usedPct}%) | Free: ${free}`);
  }
}, 30 * 1000); 




export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function transaction(callback) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release(); // LUÔN release, kể cả khi lỗi
  }
}

export async function getConnection() {
  return await pool.getConnection();
}

export { pool };