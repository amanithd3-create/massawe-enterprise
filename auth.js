import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db.js";
import { auth } from "../middleware.js";
const router=Router();
const registerSchema=z.object({name:z.string().min(2).max(80),email:z.string().email(),password:z.string().min(10).max(100)});
router.post("/register",async(req,res)=>{
  const parsed=registerSchema.safeParse(req.body); if(!parsed.success)return res.status(400).json({error:"Enter a valid name, email and password (at least 10 characters)."});
  const {name,email,password}=parsed.data;
  try{
    const passwordHash=await bcrypt.hash(password,12);
    const user=await prisma.user.create({data:{name,email:email.toLowerCase(),passwordHash}});
    const token=jwt.sign({sub:user.id,role:user.role,email:user.email},process.env.JWT_SECRET,{expiresIn:"7d"});
    res.status(201).json({token,user:{id:user.id,name:user.name,email:user.email,role:user.role}});
  }catch(e){if(e.code==="P2002")return res.status(409).json({error:"An account with that email already exists."});throw e;}
});
router.post("/login",async(req,res)=>{
  const parsed=z.object({email:z.string().email(),password:z.string().min(1)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Enter your email and password."});
  const user=await prisma.user.findUnique({where:{email:parsed.data.email.toLowerCase()}});
  if(!user||!(await bcrypt.compare(parsed.data.password,user.passwordHash)))return res.status(401).json({error:"Incorrect email or password."});
  const token=jwt.sign({sub:user.id,role:user.role,email:user.email},process.env.JWT_SECRET,{expiresIn:"7d"});
  res.json({token,user:{id:user.id,name:user.name,email:user.email,role:user.role}});
});
router.get("/me",auth(),async(req,res)=>{const user=await prisma.user.findUnique({where:{id:req.user.sub},select:{id:true,name:true,email:true,role:true,phone:true}});res.json({user});});
export default router;
