import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
export async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Faça login para continuar.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    const user = await User.findByPk(payload.id);
    if (!user || !user.active || Number(payload.tokenVersion) !== Number(user.tokenVersion)) return res.status(401).json({ message: 'Sessão inválida ou revogada. Faça login novamente.' });
    req.user = user; req.companyId = user.CompanyId; next();
  } catch { return res.status(401).json({ message: 'Sessão inválida ou expirada.' }); }
}
