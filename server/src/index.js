import dotenv from 'dotenv';
import express from 'express'; import cors from 'cors'; import helmet from 'helmet'; import rateLimit from 'express-rate-limit'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { db } from './models/index.js'; import authRoutes from './routes/auth.js'; import apiRoutes from './routes/api.js'; import advancedRoutes from './routes/advanced.js'; import { startNotificationScheduler } from './services/scheduler.js'; import webhookRoutes from './routes/webhooks.js';
if(process.env.NODE_ENV==='production'&&(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)){throw new Error('JWT_SECRET forte (mínimo 32 caracteres) é obrigatório em produção.')}
const __dirname=path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const app=express();app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'},contentSecurityPolicy:{directives:{defaultSrc:["'self'"],connectSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com','data:'],imgSrc:["'self'",'data:','blob:','https:'],scriptSrc:["'self'"],workerSrc:["'self'"],frameSrc:["'self'",'blob:'],objectSrc:["'none'"]}}}));app.use(cors({origin:process.env.CLIENT_URL||'http://localhost:5173'}));app.use(express.json({limit:'2mb'}));app.use(rateLimit({windowMs:15*60*1000,max:500}));
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads'), { maxAge: '7d', immutable: true }));
app.get('/api/health',(req,res)=>res.json({status:'ok',service:'OficinaPro API'}));app.use('/api/auth',authRoutes);app.use('/api/webhooks',webhookRoutes);app.use('/api',advancedRoutes);app.use('/api',apiRoutes);
if(process.env.NODE_ENV==='production'){const clientDist=path.resolve(__dirname,'../../client/dist');app.use(express.static(clientDist));app.get('*',(req,res)=>res.sendFile(path.join(clientDist,'index.html')))}
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({message:'Erro interno do servidor.'})});
const port=process.env.PORT||3333;db.authenticate().then(()=>db.sync(process.env.NODE_ENV==='production'?{}:{alter:true})).then(()=>app.listen(port,()=>{console.log(`OficinaPro API em http://localhost:${port}`);startNotificationScheduler();})).catch(e=>{console.error('Falha ao conectar no MySQL:',e.message);process.exit(1)});
