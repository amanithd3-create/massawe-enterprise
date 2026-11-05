import {Router} from "express";
import {prisma} from "../db.js";
import {auth,admin} from "../middleware.js";
import {z} from "zod";
const router=Router();router.use(auth(),admin);
router.get("/dashboard",async(req,res)=>{
 const [orders,products,customers]=await Promise.all([prisma.order.findMany(),prisma.product.count(),prisma.user.count({where:{role:"CUSTOMER"}})]);
 const paid=orders.filter(o=>o.paymentStatus==="PAID");
 res.json({orders:orders.length,products,customers,revenue:paid.reduce((n,o)=>n+o.total,0),currency:"TZS",recentOrders:await prisma.order.findMany({take:8,orderBy:{createdAt:"desc"}})});
});
router.get("/customers",async(req,res)=>res.json({customers:await prisma.user.findMany({where:{role:"CUSTOMER"},select:{id:true,name:true,email:true,phone:true,createdAt:true,_count:{select:{orders:true}}},orderBy:{createdAt:"desc"}})}));
router.get("/discounts",async(req,res)=>res.json({discounts:await prisma.discount.findMany({orderBy:{createdAt:"desc"}})}));
router.post("/discounts",async(req,res)=>{const p=z.object({code:z.string().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/),percentOff:z.number().int().min(1).max(100).optional(),amountOff:z.number().int().positive().optional(),usageLimit:z.number().int().positive().optional()}).refine(x=>Boolean(x.percentOff)||Boolean(x.amountOff)).safeParse(req.body);if(!p.success)return res.status(400).json({error:"Provide a code and a percentage or fixed amount."});const discount=await prisma.discount.create({data:{...p.data,code:p.data.code.toUpperCase()}});res.status(201).json({discount});});
router.delete("/discounts/:id",async(req,res)=>{await prisma.discount.delete({where:{id:req.params.id}});res.status(204).end();});
export default router;
