import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { auth,admin } from "../middleware.js";
import { createCheckout } from "../payment.js";
const router=Router();
const checkoutSchema=z.object({customerName:z.string().min(2),email:z.string().email(),phone:z.string().optional(),address:z.string().min(5),city:z.string().min(2),country:z.string().default("Tanzania"),items:z.array(z.object({productId:z.string(),quantity:z.number().int().min(1).max(50)})).min(1).max(50),discountCode:z.string().optional()});
router.post("/",auth(false),async(req,res)=>{
 const parsed=checkoutSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"Check your checkout details."});
 const data=parsed.data;
 try{
  const order=await prisma.$transaction(async tx=>{
   const ids=[...new Set(data.items.map(i=>i.productId))];
   const products=await tx.product.findMany({where:{id:{in:ids},active:true}});
   if(products.length!==ids.length)throw Object.assign(new Error("A product is unavailable."),{status:400});
   let subtotal=0;const lines=[];
   for(const item of data.items){const p=products.find(x=>x.id===item.productId);if(!p||p.stock<item.quantity)throw Object.assign(new Error(`Not enough stock for ${p?.title||"an item"}.`),{status:409});subtotal+=p.price*item.quantity;lines.push({productId:p.id,title:p.title,sku:p.sku,unitPrice:p.price,quantity:item.quantity});}
   let discount=0;
   if(data.discountCode){const d=await tx.discount.findUnique({where:{code:data.discountCode.toUpperCase()}});if(!d||!d.active||(d.expiresAt&&d.expiresAt<new Date())||(d.usageLimit!==null&&d.usedCount>=d.usageLimit))throw Object.assign(new Error("Discount code is invalid or expired."),{status:400});discount=d.percentOff?Math.floor(subtotal*d.percentOff/100):Math.min(subtotal,d.amountOff||0);await tx.discount.update({where:{id:d.id},data:{usedCount:{increment:1}}});}
   const orderNumber=`ME-${Date.now()}-${Math.floor(Math.random()*900+100)}`;
   const created=await tx.order.create({data:{orderNumber,userId:req.user?.sub,email:data.email.toLowerCase(),customerName:data.customerName,phone:data.phone,address:data.address,city:data.city,country:data.country,subtotal,discount,total:subtotal-discount,discountCode:data.discountCode?.toUpperCase(),items:{create:lines}}});
   return created;
  });
  // Stock is reserved only after payment integration is completed; this avoids false paid/stock claims.
  let checkout=null;
  try{checkout=await createCheckout({order});}catch(e){return res.status(e.status||503).json({error:e.message,orderNumber:order.orderNumber,paymentConfigured:false});}
  res.status(201).json({order,checkout,paymentConfigured:true});
 }catch(e){res.status(e.status||500).json({error:e.message||"Could not create order."});}
});
router.get("/mine",auth(),async(req,res)=>{res.json({orders:await prisma.order.findMany({where:{userId:req.user.sub},include:{items:true},orderBy:{createdAt:"desc"}})});});
router.get("/",auth(),admin,async(req,res)=>{res.json({orders:await prisma.order.findMany({include:{items:true},orderBy:{createdAt:"desc"}})});});
router.patch("/:id/status",auth(),admin,async(req,res)=>{const parsed=z.object({status:z.enum(["PENDING","PAID","PROCESSING","FULFILLED","CANCELLED","REFUNDED"])}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"Invalid order status"});const order=await prisma.order.update({where:{id:req.params.id},data:{status:parsed.data.status}});res.json({order});});
export default router;
