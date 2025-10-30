const { pool } = require("./db");
const logger = require("./logger");

const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  logger.error("❌ DB_ENCRYPTION_KEY is missing in environment variables");
  process.exit(1);
}

/**
 * Encrypt a string or number before storing in DB.
 * Returns a pgcrypto-safe SQL expression for parameterized queries.
 * Example usage in INSERT/UPDATE:
 *   const sql = `INSERT INTO users (email) VALUES (${encrypt('user@example.com')})`;
 */
const encrypt = (value) => {
  try {
    if (value === undefined || value === null) return null;
    // Use pgp_sym_encrypt for strong symmetric encryption
    return `pgp_sym_encrypt($1::text, $2::text)`;
  } catch (err) {
    logger.error(`❌ Encryption helper failed: ${err.message}`, { stack: err.stack });
    throw new Error("ENCRYPTION_FAILED");
  }
};

/**
 * Decrypt a column in SELECT queries.
 * Example usage:
 *   const sql = `SELECT ${decrypt('email')} AS email FROM users WHERE id=$1`;
 */
const decrypt = (column) => {
  try {
    if (!column) throw new Error("Column name required for decryption");
    return `pgp_sym_decrypt(${column}::bytea, '${ENCRYPTION_KEY}')::text`;
  } catch (err) {
    logger.error(`❌ Decryption helper failed for column "${column}": ${err.message}`, { stack: err.stack });
    throw new Error("DECRYPTION_FAILED");
  }
};

/**
 * Helper: encrypt & execute a value in a parameterized query
 */
const encryptValue = async (table, column, value, whereClause, whereParams = []) => {
  try {
    if (!table || !column || !whereClause) {
      throw new Error("Table, column, and whereClause are required for encryptValue");
    }

    const sql = `UPDATE ${table} SET ${column} = pgp_sym_encrypt($1::text, $2::text) WHERE ${whereClause}`;
    await pool.query(sql, [value, ENCRYPTION_KEY, ...whereParams]);
    logger.info(`✅ Encrypted column "${column}" in table "${table}"`);
  } catch (err) {
    logger.error(`❌ Failed to encrypt column "${column}" in table "${table}": ${err.message}`, { stack: err.stack });
    throw new Error("DB_ENCRYPTION_OPERATION_FAILED");
  }
};

/**
 * Helper: decrypt & fetch a value from DB
 */
const decryptValue = async (table, column, whereClause, whereParams = []) => {
  try {
    if (!table || !column || !whereClause) {
      throw new Error("Table, column, and whereClause are required for decryptValue");
    }

    const sql = `SELECT pgp_sym_decrypt(${column}::bytea, $1::text)::text AS decrypted FROM ${table} WHERE ${whereClause}`;
    const { rows } = await pool.query(sql, [ENCRYPTION_KEY, ...whereParams]);
    return rows;
  } catch (err) {
    logger.error(`❌ Failed to decrypt column "${column}" in table "${table}": ${err.message}`, { stack: err.stack });
    throw new Error("DB_DECRYPTION_OPERATION_FAILED");
  }
};

module.exports = {
  encrypt,
  decrypt,
  encryptValue,
  decryptValue,
};
