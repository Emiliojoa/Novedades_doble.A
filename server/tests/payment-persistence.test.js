import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("Migración SQLite preserva pedidos históricos; pagos, configuración y comprobantes sobreviven un reinicio", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "doblea-payment-persistence-"));
  const database = path.join(dir, "store.db");
  const schemaUrl = new URL("../config/sqlite.js", import.meta.url).href;
  function run(code) {
    return execFileSync(process.execPath, ["--input-type=module", "-e", code], {
      env: { ...process.env, DATABASE_PATH: database },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  try {
    run(`import {DatabaseSync} from 'node:sqlite';
      const old = new DatabaseSync(process.env.DATABASE_PATH);
      old.exec("CREATE TABLE users(id INTEGER PRIMARY KEY, role TEXT); INSERT INTO users VALUES(1,'CLIENT'); CREATE TABLE orders(id INTEGER PRIMARY KEY,user_id INTEGER,total INTEGER,status TEXT DEFAULT 'PENDIENTE',created_at TEXT DEFAULT CURRENT_TIMESTAMP); INSERT INTO orders(id,user_id,total) VALUES(1,1,5000000)"); old.close();
      const {db} = await import(${JSON.stringify(schemaUrl)});
      const legacy=db.prepare('SELECT * FROM orders').get();
      if(legacy.total!==5000000 || legacy.subtotal!==5000000 || legacy.payment_method!==null) throw Error('Legacy changed');
      db.exec("UPDATE payment_settings SET bank_alias='persisted.alias.mp'; UPDATE orders SET payment_method='TRANSFERENCIA',payment_status='REJECTED' WHERE id=1; INSERT INTO payment_receipts(id,user_id,order_id,storage_path,original_filename,mime_type,file_size,local_content,verification_status,rejection_reason) VALUES('receipt',1,1,'private/path','receipt.pdf','application/pdf',5,'cGRm','REJECTED','Importe ilegible')"); db.close();`);
    const result = JSON.parse(
      run(
        `const {db}=await import(${JSON.stringify(schemaUrl)});console.log(JSON.stringify({order:db.prepare('SELECT * FROM orders').get(),settings:db.prepare('SELECT * FROM payment_settings').get(),receipt:db.prepare('SELECT * FROM payment_receipts').get()}));db.close();`,
      ),
    );
    assert.equal(result.order.total, 5000000);
    assert.equal(result.order.payment_status, "REJECTED");
    assert.equal(result.settings.bank_alias, "persisted.alias.mp");
    assert.equal(result.receipt.local_content, "cGRm");
    assert.equal(result.receipt.rejection_reason, "Importe ilegible");
  } finally {
    for (const name of readdirSync(dir)) unlinkSync(path.join(dir, name));
    rmdirSync(dir);
  }
});
