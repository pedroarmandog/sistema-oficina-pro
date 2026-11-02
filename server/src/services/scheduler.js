import webpush from 'web-push';
import { Op } from 'sequelize';
import { NotificationJob, PushSubscription } from '../models/index.js';
export function startNotificationScheduler(){
  if(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY){webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:admin@oficinapro.app',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);}
  const tick=async()=>{if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)return;const jobs=await NotificationJob.findAll({where:{status:'pending',scheduledAt:{[Op.lte]:new Date()}},limit:50});for(const job of jobs){const [claimed]=await NotificationJob.update({status:'processing'},{where:{id:job.id,status:'pending'}});if(!claimed)continue;const subs=await PushSubscription.findAll({where:{CompanyId:job.CompanyId}});const results=await Promise.allSettled(subs.map(s=>webpush.sendNotification({endpoint:s.endpoint,keys:s.keys},JSON.stringify({title:job.title,body:job.body,url:'/app'}))));for(let i=0;i<results.length;i++){if(results[i].status==='rejected'&&results[i].reason?.statusCode===410)await subs[i].destroy();}await job.update({status:results.some(x=>x.status==='fulfilled')?'sent':'failed',sentAt:new Date()});}};
  const timer=setInterval(()=>tick().catch(e=>console.error('Notification scheduler:',e.message)),30000);timer.unref();tick().catch(e=>console.error('Notification scheduler:',e.message));
}
