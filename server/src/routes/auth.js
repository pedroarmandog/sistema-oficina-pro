import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { Company, User, PasswordReset, db } from '../models/index.js';
const router = Router();
const tokenFor = user => jwt.sign({ id: user.id, companyId: user.CompanyId, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET || 'dev-secret-change-me', { expiresIn: '7d' });
router.post('/register', async (req,res) => {
  try {
    const { companyName, name, email, password, segment, phone } = req.body;
    if (!companyName || !name || !email || !password || password.length < 10) return res.status(400).json({message:'Informe empresa, nome, e-mail e senha com pelo menos 10 caracteres.'});
    if (await User.findOne({where:{email}})) return res.status(409).json({message:'Este e-mail já está cadastrado.'});
    const result = await Company.sequelize.transaction(async t => {
      const company = await Company.create({name:companyName, segment:segment || 'oficina_mecanica', email, phone}, {transaction:t});
      const user = await User.create({name,email,password:await bcrypt.hash(password,12),role:'owner',CompanyId:company.id}, {transaction:t});
      return {company,user};
    });
    res.status(201).json({token:tokenFor(result.user), user:{id:result.user.id,name:result.user.name,email:result.user.email,role:result.user.role}, company:result.company});
  } catch(e) { res.status(500).json({message:'Não foi possível criar a conta.', detail:process.env.NODE_ENV==='development'?e.message:undefined}); }
});
router.post('/login', async (req,res) => {
  const {email,password}=req.body; const user=await User.findOne({where:{email}});
  if(!user || !await bcrypt.compare(password || '',user.password)) return res.status(401).json({message:'E-mail ou senha incorretos.'});
  const company=await Company.findByPk(user.CompanyId);
  if(!company?.active) return res.status(403).json({message:'Empresa desativada.'});
  res.json({token:tokenFor(user),user:{id:user.id,name:user.name,email:user.email,role:user.role},company});
});

router.post('/forgot-password', async(req,res)=>{const email=String(req.body.email||'').toLowerCase().trim();const user=await User.findOne({where:{email}});if(user){const raw=crypto.randomBytes(32).toString('hex');await PasswordReset.create({UserId:user.id,CompanyId:user.CompanyId,tokenHash:crypto.createHash('sha256').update(raw).digest('hex'),expiresAt:new Date(Date.now()+30*60*1000)});if(process.env.SMTP_HOST){const nodemailer=(await import('nodemailer')).default;const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}});await transporter.sendMail({from:process.env.SMTP_FROM,to:user.email,subject:'Redefinição de senha OficinaPro',text:`Use este token no formulário de redefinição: ${raw}. Ele expira em 30 minutos.`});}else if(process.env.NODE_ENV==='development')console.info('DEV password reset token:',raw);}res.json({message:'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.'});});
router.post('/reset-password', async(req,res)=>{const {email,token,password}=req.body;if(!email||!token||!password||password.length<10)return res.status(400).json({message:'Dados inválidos. A nova senha deve ter pelo menos 10 caracteres.'});const user=await User.findOne({where:{email}});if(!user)return res.status(400).json({message:'Token inválido ou expirado.'});const hash=crypto.createHash('sha256').update(token).digest('hex');const reset=await PasswordReset.findOne({where:{UserId:user.id,tokenHash:hash,usedAt:null,expiresAt:{[Op.gt]:new Date()}}});if(!reset)return res.status(400).json({message:'Token inválido ou expirado.'});await db.transaction(async t=>{await user.update({password:await bcrypt.hash(password,12),tokenVersion:Number(user.tokenVersion||0)+1},{transaction:t});await reset.update({usedAt:new Date()},{transaction:t});});res.json({message:'Senha redefinida com sucesso.'});});
export default router;
