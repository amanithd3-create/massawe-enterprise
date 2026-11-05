import {Router} from "express";
import {prisma} from "../db.js";
import {verifyWebhook} from "../payment.js";
const router=Router();
router.post("/webhook",async(req,res)=>{
 if(!verifyWebhook(req))return res.status(401).json({error:"Invalid payment webhook signature"});
 // Update payment status only after provider-specific signature, amount, currency and reference checks.
 return res.status(501).json({error:"Webhook adapter must be completed for the selected provider."});
});
router.get("/status/:orderNumber",async(req,res)=>{const order=await prisma.order.findUnique({where:{orderNumber:req.params.orderNumber},select:{orderNumber:true,status:true,paymentStatus:true,total:true,currency:true}});if(!order)return res.status(404).json({error:"Order not found"});res.json({order});});
export default router;
