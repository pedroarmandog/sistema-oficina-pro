import 'dotenv/config'; import { db } from './models/index.js';
try { await db.authenticate(); await db.sync({alter:true}); console.log('Tabelas sincronizadas.'); process.exit(0); } catch(e) { console.error(e); process.exit(1); }
