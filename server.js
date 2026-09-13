require("dotenv").config();
const express=require("express"), cors=require("cors"), path=require("path"), bcrypt=require("bcryptjs"), jwt=require("jsonwebtoken"), Database=require("better-sqlite3");
const app=express(), PORT=process.env.PORT||3000, SECRET=process.env.JWT_SECRET||"dev-secret-change-me";
const db=new Database(path.join(__dirname,"data","app.db"));
db.pragma("journal_mode = WAL");
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tools(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,url TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS courses(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,description TEXT NOT NULL,level TEXT NOT NULL,lessons INTEGER NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS enrollments(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,course_id INTEGER NOT NULL,progress INTEGER NOT NULL DEFAULT 0,UNIQUE(user_id,course_id));
CREATE TABLE IF NOT EXISTS lessons(id INTEGER PRIMARY KEY AUTOINCREMENT,course_id INTEGER NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,position INTEGER NOT NULL DEFAULT 1);`);
if(!db.prepare("SELECT 1 FROM users WHERE email=?").get(process.env.ADMIN_EMAIL||"admin@aienrnhub.local")){
 const email=process.env.ADMIN_EMAIL||"admin@aienrnhub.local", pw=process.env.ADMIN_PASSWORD||"ChangeMe123!";
 db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)").run("Admin",email,bcrypt.hashSync(pw,12),"admin");
}
if(db.prepare("SELECT COUNT(*) c FROM tools").get().c===0){
 const add=db.prepare("INSERT INTO tools(name,category,description,url) VALUES(?,?,?,?)");
 [["Video AI","Content","Create and edit short-form videos with AI workflows.","https://example.com"],["AI Writing","Writing","Draft scripts, captions, outlines and marketing copy.","https://example.com"],["Image Design","Design","Generate concepts, thumbnails and social graphics.","https://example.com"],["Automation","Productivity","Connect repetitive tasks into practical AI workflows.","https://example.com"],["Research AI","Research","Summarize and organize information faster.","https://example.com"],["Code Assistant","Development","Prototype websites and small tools with AI help.","https://example.com"]].forEach(x=>add.run(...x));
}
if(db.prepare("SELECT COUNT(*) c FROM courses").get().c===0){
 const add=db.prepare("INSERT INTO courses(title,description,level,lessons) VALUES(?,?,?,?)");
 [["AI Content Starter","Build an original AI-assisted Shorts workflow.","Beginner",6],["AI Freelancing Blueprint","Turn practical AI skills into freelance services.","Beginner",8],["AI Automation Basics","Design simple automations for creators and businesses.","Intermediate",7]].forEach(x=>add.run(...x));
}
app.use(cors()); app.use(express.json()); app.use(express.static(path.join(__dirname,"public")));
function token(u){return jwt.sign({id:u.id,email:u.email,role:u.role},SECRET,{expiresIn:"7d"})}
function auth(req,res,next){try{req.user=jwt.verify((req.headers.authorization||"").replace("Bearer ",""),SECRET);next()}catch(e){res.status(401).json({error:"Authentication required"})}}
function admin(req,res,next){if(req.user?.role!=="admin")return res.status(403).json({error:"Admin access required"});next()}
app.post("/api/auth/signup",(req,res)=>{const {name,email,password}=req.body||{};if(!name||!email||!password||password.length<8)return res.status(400).json({error:"Name, email and password (8+ characters) are required"});try{const info=db.prepare("INSERT INTO users(name,email,password) VALUES(?,?,?)").run(name,email.toLowerCase(),bcrypt.hashSync(password,12));const u=db.prepare("SELECT id,name,email,role FROM users WHERE id=?").get(info.lastInsertRowid);res.json({user:u,token:token(u)})}catch(e){res.status(409).json({error:"Email is already registered"})}});
app.post("/api/auth/login",(req,res)=>{const {email,password}=req.body||{},u=db.prepare("SELECT * FROM users WHERE email=?").get((email||"").toLowerCase());if(!u||!bcrypt.compareSync(password||"",u.password))return res.status(401).json({error:"Invalid email or password"});res.json({user:{id:u.id,name:u.name,email:u.email,role:u.role},token:token(u)})});
app.get("/api/me",auth,(req,res)=>res.json({user:db.prepare("SELECT id,name,email,role,created_at FROM users WHERE id=?").get(req.user.id)}));
app.get("/api/tools",(req,res)=>res.json(db.prepare("SELECT * FROM tools ORDER BY id DESC").all()));
app.get("/api/tools/:id",(req,res)=>{const x=db.prepare("SELECT * FROM tools WHERE id=?").get(req.params.id);x?res.json(x):res.status(404).json({error:"Tool not found"})});
app.get("/api/courses",(req,res)=>res.json(db.prepare("SELECT * FROM courses ORDER BY id DESC").all()));
app.get("/api/courses/:id",(req,res)=>{const c=db.prepare("SELECT * FROM courses WHERE id=?").get(req.params.id);if(!c)return res.status(404).json({error:"Course not found"});c.lessonsList=db.prepare("SELECT id,title,content,position FROM lessons WHERE course_id=? ORDER BY position").all(c.id);res.json(c)});
app.post("/api/courses/:id/enroll",auth,(req,res)=>{try{db.prepare("INSERT INTO enrollments(user_id,course_id) VALUES(?,?)").run(req.user.id,req.params.id);res.json({ok:true})}catch(e){res.json({ok:true,message:"Already enrolled"})}});
app.get("/api/my-courses",auth,(req,res)=>res.json(db.prepare("SELECT c.*,e.progress FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=?").all(req.user.id)));
app.patch("/api/my-courses/:id",auth,(req,res)=>{const p=Math.max(0,Math.min(100,Number(req.body.progress)||0));db.prepare("UPDATE enrollments SET progress=? WHERE user_id=? AND course_id=?").run(p,req.user.id,req.params.id);res.json({ok:true,progress:p})});
app.get("/api/admin/stats",auth,admin,(req,res)=>res.json({users:db.prepare("SELECT COUNT(*) c FROM users").get().c,tools:db.prepare("SELECT COUNT(*) c FROM tools").get().c,courses:db.prepare("SELECT COUNT(*) c FROM courses").get().c,enrollments:db.prepare("SELECT COUNT(*) c FROM enrollments").get().c}));
app.get("/api/admin/users",auth,admin,(req,res)=>res.json(db.prepare("SELECT id,name,email,role,created_at FROM users ORDER BY id DESC").all()));
app.post("/api/admin/tools",auth,admin,(req,res)=>{const {name,category,description,url=""}=req.body||{};if(!name||!category||!description)return res.status(400).json({error:"Missing fields"});const x=db.prepare("INSERT INTO tools(name,category,description,url) VALUES(?,?,?,?)").run(name,category,description,url);res.json(db.prepare("SELECT * FROM tools WHERE id=?").get(x.lastInsertRowid))});
app.delete("/api/admin/tools/:id",auth,admin,(req,res)=>{db.prepare("DELETE FROM tools WHERE id=?").run(req.params.id);res.json({ok:true})});
app.post("/api/admin/courses",auth,admin,(req,res)=>{const {title,description,level="Beginner",lessons=1}=req.body||{};if(!title||!description)return res.status(400).json({error:"Missing fields"});const x=db.prepare("INSERT INTO courses(title,description,level,lessons) VALUES(?,?,?,?)").run(title,description,level,Number(lessons)||1);res.json(db.prepare("SELECT * FROM courses WHERE id=?").get(x.lastInsertRowid))});
app.delete("/api/admin/courses/:id",auth,admin,(req,res)=>{db.prepare("DELETE FROM courses WHERE id=?").run(req.params.id);db.prepare("DELETE FROM lessons WHERE course_id=?").run(req.params.id);res.json({ok:true})});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`AI Earn Hub running on http://localhost:${PORT}`));