import jwt from "jsonwebtoken";
export function auth(required = true) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return required ? res.status(401).json({ error: "Sign in required" }) : next();
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }
  };
}
export function admin(req,res,next) {
  if (!req.user || !["ADMIN","STAFF"].includes(req.user.role)) return res.status(403).json({error:"Administrator access required"});
  next();
}
