import { Router } from 'express';
import { Subscription } from '../models/index.js';
const router=Router();
router.post('/billing/:provider',async(req,res)=>{const secret=req.headers['x-webhook-secret'];if(!process.env.BILLING_WEBHOOK_SECRET||secret!==process.env.BILLING_WEBHOOK_SECRET)return res.status(401).json({message:'Webhook não autorizado.'});const {subscriptionId,status,providerId}=req.body;if(!['active','past_due','canceled','trialing','pending'].includes(status))return res.status(400).json({message:'Status inválido.'});const sub=await Subscription.findByPk(subscriptionId);if(!sub)return res.status(404).json({message:'Assinatura não encontrada.'});await sub.update({status,provider:req.params.provider,providerId});res.json({received:true});});
export default router;
