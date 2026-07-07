import os, uuid, hashlib, hmac, time, json, sqlite3
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, abort, Response
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

try:
    import psycopg
    from psycopg.rows import dict_row
except Exception:
    psycopg = None

try:
    import requests
except Exception:
    requests = None

ROOT=Path(__file__).resolve().parent
DATA_DIR=Path(os.environ.get("ALIN_DATA_DIR", str(ROOT)))
DB=Path(os.environ.get("ALIN_DB_PATH", str(DATA_DIR/"instance"/"alin.db")))
UPLOADS=Path(os.environ.get("ALIN_UPLOADS_PATH", str(DATA_DIR/"uploads")))
SECRET=os.environ.get("ALIN_SECRET","CHANGE-ME-IN-PRODUCTION")
ADMIN_USER=os.environ.get("ALIN_ADMIN_USER","admin")
ADMIN_PASS=os.environ.get("ALIN_ADMIN_PASS","1234")

DATABASE_URL=os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL") or ""
USE_POSTGRES=bool(DATABASE_URL)
SUPABASE_URL=(os.environ.get("SUPABASE_URL") or "").rstrip("/")
SUPABASE_KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY") or ""
SUPABASE_BUCKET=os.environ.get("SUPABASE_BUCKET","alin-files")
USE_SUPABASE_STORAGE=bool(SUPABASE_URL and SUPABASE_KEY and requests)

app=Flask(__name__, static_folder="public", static_url_path="")
app.config["MAX_CONTENT_LENGTH"]=100*1024*1024

def uid(p): return p+uuid.uuid4().hex[:16]

def convert_sql(q):
    if USE_POSTGRES:
        q=q.replace("datetime('now')","CURRENT_TIMESTAMP")
        q=q.replace("CURRENT_TIMESTAMP","CURRENT_TIMESTAMP")
        q=q.replace(" INTEGER DEFAULT 1"," INTEGER DEFAULT 1")
        return q.replace("?", "%s")
    return q

def con():
    if USE_POSTGRES:
        if psycopg is None:
            raise RuntimeError("psycopg غير مثبت. نفّذ pip install -r requirements.txt")
        return psycopg.connect(DATABASE_URL, row_factory=dict_row)
    DB.parent.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(DB); c.row_factory=sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    return c

def rows(q,args=()):
    with con() as c:
        cur=c.execute(convert_sql(q),args)
        return [dict(x) for x in cur.fetchall()]

def one(q,args=()):
    with con() as c:
        cur=c.execute(convert_sql(q),args)
        x=cur.fetchone()
        return dict(x) if x else None

def execsql(q,args=()):
    with con() as c:
        c.execute(convert_sql(q),args)
        c.commit()

def audit(kind,text):
    execsql("INSERT INTO audit(id,kind,text,created_at) VALUES(?,?,?,CURRENT_TIMESTAMP)",(uid("A"),kind,text))

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, role TEXT NOT NULL, name TEXT NOT NULL, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, area TEXT, landmark TEXT, status TEXT DEFAULT 'active');
CREATE TABLE IF NOT EXISTS booklets(id TEXT PRIMARY KEY,title TEXT NOT NULL,teacher_id TEXT NOT NULL,subject TEXT,grade TEXT,price INTEGER NOT NULL,cover_path TEXT,teacher_image_path TEXT,file_path TEXT,file_name TEXT,status TEXT DEFAULT 'published',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,type TEXT,name TEXT,category TEXT,price INTEGER,stock INTEGER DEFAULT 0,image_path TEXT,status TEXT DEFAULT 'published');
CREATE TABLE IF NOT EXISTS banners(id TEXT PRIMARY KEY,title TEXT,text TEXT,active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,kind TEXT,item_id TEXT,title TEXT,student_name TEXT,student_phone TEXT,library_id TEXT,qty INTEGER,unit_price INTEGER,total INTEGER,status TEXT,payment_status TEXT,payment_ref TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS permits(id TEXT PRIMARY KEY,order_id TEXT,booklet_id TEXT,library_id TEXT,qty INTEGER,used INTEGER DEFAULT 0,status TEXT DEFAULT 'active',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,order_id TEXT UNIQUE,alin INTEGER,teacher INTEGER,teacher_id TEXT,library INTEGER,library_id TEXT,settlement_status TEXT DEFAULT 'unsettled',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS withdrawals(id TEXT PRIMARY KEY,role TEXT,account_id TEXT,amount INTEGER,status TEXT DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,kind TEXT,text TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,type TEXT NOT NULL,name TEXT NOT NULL,status TEXT DEFAULT 'active');
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT);
"""

def init():
    UPLOADS.mkdir(parents=True,exist_ok=True)
    DB.parent.mkdir(parents=True,exist_ok=True)
    with con() as c:
        if USE_POSTGRES:
            for stmt in [s.strip() for s in SQLITE_SCHEMA.split(";") if s.strip()]:
                c.execute(convert_sql(stmt))
        else:
            c.executescript(SQLITE_SCHEMA)
        if not c.execute(convert_sql("SELECT 1 FROM accounts LIMIT 1")).fetchone():
            c.execute(convert_sql("INSERT INTO accounts(id,role,name,username,password_hash,area,landmark,status) VALUES(?,?,?,?,?,?,?,?)"),("T1","teacher","ميسر صلاح الدين","0770",generate_password_hash("1234"),"كركوك","","active"))
            c.execute(convert_sql("INSERT INTO accounts(id,role,name,username,password_hash,area,landmark,status) VALUES(?,?,?,?,?,?,?,?)"),("L1","library","مكتبة آلين","LIB1",generate_password_hash("1234"),"كركوك","قرب المركز","active"))
            c.execute(convert_sql("INSERT INTO booklets(id,title,teacher_id,subject,grade,price,status) VALUES(?,?,?,?,?,?,?)"),("B1","ملزمة الفيزياء","T1","الفيزياء","السادس الإعدادي",10000,"published"))
            c.execute(convert_sql("INSERT INTO banners(id,title,text,active) VALUES(?,?,?,1)"),("AD1","الأستاذ ميسر صلاح الدين انضم إلى منصة آلين","ملازمه متوفرة الآن"))
        if not c.execute(convert_sql("SELECT 1 FROM categories LIMIT 1")).fetchone():
            for cid, typ, name in [("C1","booklet","السادس الإعدادي"),("C2","stationery","دفاتر"),("C3","stationery","أقلام"),("C4","gift","هدايا")]:
                c.execute(convert_sql("INSERT INTO categories(id,type,name,status) VALUES(?,?,?,'active')"),(cid,typ,name))
        c.commit()

def storage_upload(file_obj, folder, allowed):
    if not file_obj or not file_obj.filename:
        return None, None
    ext=Path(file_obj.filename).suffix.lower()
    if ext not in allowed:
        raise ValueError("امتداد الملف غير مسموح")
    filename=uuid.uuid4().hex+ext
    rel=f"{folder}/{filename}"
    original=secure_filename(file_obj.filename)
    if USE_SUPABASE_STORAGE:
        url=f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{rel}"
        data=file_obj.read()
        headers={"Authorization":f"Bearer {SUPABASE_KEY}","apikey":SUPABASE_KEY,"Content-Type":file_obj.mimetype or "application/octet-stream","x-upsert":"true"}
        r=requests.post(url,headers=headers,data=data,timeout=60)
        if r.status_code not in (200,201):
            raise ValueError("فشل رفع الملف إلى Supabase Storage: "+r.text[:160])
    else:
        p=UPLOADS/folder
        p.mkdir(parents=True,exist_ok=True)
        file_obj.save(p/filename)
    return rel, original

def storage_read(rel):
    if USE_SUPABASE_STORAGE:
        url=f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{rel}"
        headers={"Authorization":f"Bearer {SUPABASE_KEY}","apikey":SUPABASE_KEY}
        r=requests.get(url,headers=headers,timeout=60)
        if r.status_code != 200:
            abort(404)
        return Response(r.content, mimetype=r.headers.get("content-type","application/octet-stream"))
    path=Path(rel)
    return send_from_directory(UPLOADS/path.parent,path.name,as_attachment=False)

@app.get("/")
def home(): return app.send_static_file("index.html")

@app.get("/api/health")
def health():
    return jsonify(ok=True,db="postgres" if USE_POSTGRES else "sqlite",storage="supabase" if USE_SUPABASE_STORAGE else "local")

@app.get("/api/state")
def state():
    ac=rows("SELECT id,role,name,username,area,landmark,status FROM accounts")
    return jsonify({
      "accounts":{"teachers":[x for x in ac if x["role"]=="teacher"],"libraries":[x for x in ac if x["role"]=="library"]},
      "booklets":rows("SELECT * FROM booklets"),"products":rows("SELECT * FROM products"),
      "banners":rows("SELECT * FROM banners"),"orders":rows("SELECT * FROM orders ORDER BY created_at DESC"),
      "permits":rows("SELECT * FROM permits ORDER BY created_at DESC"),"ledger":rows("SELECT * FROM ledger ORDER BY created_at DESC"),
      "withdrawals":rows("SELECT * FROM withdrawals ORDER BY created_at DESC"),"audit":rows("SELECT * FROM audit ORDER BY created_at DESC"),
      "categories":rows("SELECT * FROM categories ORDER BY type,name"),"settings":{x["key"]:x["value"] for x in rows("SELECT * FROM settings")}
    })

@app.post("/api/login")
def login():
    d=request.get_json() or {}; role=d.get("role"); user=d.get("user",""); pw=d.get("pass","")
    if role=="admin":
        if hmac.compare_digest(user,ADMIN_USER) and hmac.compare_digest(pw,ADMIN_PASS): return jsonify({"role":"admin","name":"منصة آلين"})
        return jsonify(error="بيانات الدخول غير صحيحة"),401
    a=one("SELECT * FROM accounts WHERE role=? AND username=?",(role,user))
    if not a or a["status"]!="active" or not check_password_hash(a["password_hash"],pw): return jsonify(error="بيانات الدخول غير صحيحة"),401
    return jsonify({"role":role,"id":a["id"],"name":a["name"],"username":a["username"]})

@app.post("/api/accounts")
def add_account():
    d=request.get_json() or {}
    if d.get("role") not in ("teacher","library"): return jsonify(error="نوع الحساب غير صحيح"),400
    try:
        aid=uid("T" if d["role"]=="teacher" else "L")
        execsql("INSERT INTO accounts(id,role,name,username,password_hash,area,landmark,status) VALUES(?,?,?,?,?,?,?,'active')",
                (aid,d["role"],d["name"],d["username"],generate_password_hash(d["password"]),d.get("area",""),d.get("landmark","")))
        audit("account","إضافة حساب "+d["name"]); return jsonify(id=aid)
    except Exception as e:
        return jsonify(error="اليوزر مستخدم أو خطأ بالبيانات"),409

@app.put("/api/accounts/<aid>")
def update_account(aid):
    d=request.get_json() or {}; a=one("SELECT * FROM accounts WHERE id=?",(aid,))
    if not a: abort(404)
    ph=generate_password_hash(d["password"]) if d.get("password") else a["password_hash"]
    execsql("UPDATE accounts SET name=?,username=?,password_hash=?,area=?,landmark=?,status=? WHERE id=?",
            (d.get("name",a["name"]),d.get("username",a["username"]),ph,d.get("area",a["area"]),d.get("landmark",a["landmark"]),d.get("status",a["status"]),aid))
    audit("account","تعديل حساب "+aid); return jsonify(ok=True)

@app.post("/api/booklets")
def add_booklet():
    try:
        cover,_=storage_upload(request.files.get("cover"),"covers",{".png",".jpg",".jpeg",".webp"})
        ti,_=storage_upload(request.files.get("teacherImage"),"teachers",{".png",".jpg",".jpeg",".webp"})
        fp,fn=storage_upload(request.files.get("bookletFile"),"booklets",{".pdf"})
        form=request.form
        if not fp: return jsonify(error="ملف PDF مطلوب"),400
        bid=uid("B")
        execsql("INSERT INTO booklets(id,title,teacher_id,subject,grade,price,cover_path,teacher_image_path,file_path,file_name,status) VALUES(?,?,?,?,?,?,?,?,?,?,'published')",
                (bid,form["title"],form["teacherId"],form.get("subject",""),form.get("grade",""),int(form["price"]),cover,ti,fp,fn))
        audit("booklet","نشر ملزمة "+form["title"]); return jsonify(id=bid)
    except (ValueError,KeyError) as e: return jsonify(error=str(e)),400

@app.put("/api/booklets/<bid>")
def edit_booklet(bid):
    b=one("SELECT * FROM booklets WHERE id=?",(bid,))
    if not b: abort(404)
    d=request.get_json() or {}
    execsql("UPDATE booklets SET title=?,teacher_id=?,subject=?,grade=?,price=? WHERE id=?",
            (d.get("title",b["title"]),d.get("teacherId",b["teacher_id"]),d.get("subject",b["subject"]),d.get("grade",b["grade"]),int(d.get("price",b["price"])),bid))
    audit("booklet","تعديل ملزمة "+bid); return jsonify(ok=True)

@app.post("/api/booklets/<bid>/status")
def booklet_status(bid):
    d=request.get_json() or {}; status=d.get("status")
    if status not in ("published","hidden","archived"): return jsonify(error="حالة غير صحيحة"),400
    execsql("UPDATE booklets SET status=? WHERE id=?",(status,bid)); audit("booklet","تغيير حالة "+bid+" إلى "+status); return jsonify(ok=True)

@app.post("/api/orders")
def create_order():
    d=request.get_json() or {}; qty=max(1,int(d.get("qty",1)))
    if d.get("kind")!="booklet": return jsonify(error="هذه النواة مفعلة لشراء الملازم المحمي"),400
    b=one("SELECT * FROM booklets WHERE id=? AND status='published'",(d.get("itemId"),))
    lib=one("SELECT * FROM accounts WHERE id=? AND role='library' AND status='active'",(d.get("libraryId"),))
    if not b or not lib or not d.get("studentName") or not d.get("studentPhone"): return jsonify(error="بيانات الطلب غير مكتملة"),400
    oid=uid("O"); total=b["price"]*qty
    execsql("INSERT INTO orders(id,kind,item_id,title,student_name,student_phone,library_id,qty,unit_price,total,status,payment_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (oid,"booklet",b["id"],b["title"],d["studentName"],d["studentPhone"],lib["id"],qty,b["price"],total,"pending","payment_pending"))
    audit("order","إنشاء طلب "+b["title"]+" × "+str(qty)); return jsonify(id=oid,paymentStatus="payment_pending")

@app.post("/api/payments/mock-confirm/<oid>")
def mock_confirm(oid):
    o=one("SELECT * FROM orders WHERE id=?",(oid,))
    if not o or o["payment_status"]=="paid": return jsonify(error="الطلب غير صالح"),400
    b=one("SELECT * FROM booklets WHERE id=?",(o["item_id"],))
    alin=round(o["total"]*.30); teacher=round(o["total"]*.50); library=o["total"]-alin-teacher
    with con() as c:
        c.execute(convert_sql("UPDATE orders SET status='paid',payment_status='paid',payment_ref=? WHERE id=?"),("DEV-"+uid("PAY"),oid))
        c.execute(convert_sql("INSERT INTO permits(id,order_id,booklet_id,library_id,qty,used,status) VALUES(?,?,?,?,?,0,'active')"),(uid("P"),oid,b["id"],o["library_id"],o["qty"]))
        c.execute(convert_sql("INSERT INTO ledger(id,order_id,alin,teacher,teacher_id,library,library_id,settlement_status) VALUES(?,?,?,?,?,?,?,'unsettled')"),(uid("LG"),oid,alin,teacher,b["teacher_id"],library,o["library_id"]))
        c.commit()
    audit("payment","تأكيد دفع تطويري للطلب "+oid); return jsonify(ok=True)

def signed_token(pid, exp):
    raw=f"{pid}:{exp}".encode(); sig=hmac.new(SECRET.encode(),raw,hashlib.sha256).hexdigest()
    return f"{pid}.{exp}.{sig}"
def verify_token(tok):
    try:
        pid,exp,sig=tok.split("."); exp=int(exp)
        if time.time()>exp: return None
        good=hmac.new(SECRET.encode(),f"{pid}:{exp}".encode(),hashlib.sha256).hexdigest()
        return pid if hmac.compare_digest(sig,good) else None
    except: return None

@app.post("/api/permits/<pid>/link")
def permit_link(pid):
    p=one("SELECT * FROM permits WHERE id=? AND status='active'",(pid,))
    if not p or p["used"]>=p["qty"]: return jsonify(error="إذن النسخ منتهي"),400
    exp=int(time.time())+300
    return jsonify(url="/protected/"+signed_token(pid,exp),expiresIn=300)

@app.get("/protected/<token>")
def protected(token):
    pid=verify_token(token)
    if not pid: abort(403)
    p=one("SELECT p.*,b.file_path FROM permits p JOIN booklets b ON b.id=p.booklet_id WHERE p.id=? AND p.status='active'",(pid,))
    if not p or p["used"]>=p["qty"] or not p["file_path"]: abort(403)
    return storage_read(p["file_path"])

@app.post("/api/permits/<pid>/use")
def use_permit(pid):
    with con() as c:
        p=c.execute(convert_sql("SELECT * FROM permits WHERE id=?"),(pid,)).fetchone()
        if not p or p["status"]!="active" or p["used"]>=p["qty"]: return jsonify(error="إذن النسخ منتهي"),400
        used=p["used"]+1; status="done" if used>=p["qty"] else "active"
        c.execute(convert_sql("UPDATE permits SET used=?,status=? WHERE id=?"),(used,status,pid)); c.commit()
    audit("copy","استخدام إذن نسخة "+pid); return jsonify(ok=True,used=used,status=status)

@app.post("/api/withdrawals")
def withdrawal():
    d=request.get_json() or {}; amount=int(d.get("amount",0))
    if amount<=0: return jsonify(error="المبلغ غير صحيح"),400
    wid=uid("W"); execsql("INSERT INTO withdrawals(id,role,account_id,amount) VALUES(?,?,?,?)",(wid,d["role"],d["accountId"],amount))
    audit("withdrawal","طلب سحب "+wid); return jsonify(id=wid)

@app.post("/api/ledger/<lid>/settle")
def settle(lid):
    execsql("UPDATE ledger SET settlement_status='settled' WHERE id=?",(lid,)); audit("finance","تسوية حركة "+lid); return jsonify(ok=True)

@app.get("/media/<path:name>")
def media(name): return storage_read(name)

@app.post("/api/products")
def add_product():
    try:
        img,_=storage_upload(request.files.get("image"),"products",{".png",".jpg",".jpeg",".webp"})
        f=request.form
        pid=uid("PR")
        execsql("INSERT INTO products(id,type,name,category,price,stock,image_path,status) VALUES(?,?,?,?,?,?,?,'published')",
                (pid,f["type"],f["name"],f.get("category",""),int(f["price"]),int(f.get("stock",0)),img))
        audit("product","إضافة منتج "+f["name"]); return jsonify(id=pid)
    except (ValueError,KeyError) as e: return jsonify(error=str(e)),400

@app.put("/api/products/<pid>")
def update_product(pid):
    p=one("SELECT * FROM products WHERE id=?",(pid,))
    if not p: abort(404)
    d=request.get_json() or {}
    execsql("UPDATE products SET type=?,name=?,category=?,price=?,stock=? WHERE id=?",
      (d.get("type",p["type"]),d.get("name",p["name"]),d.get("category",p["category"]),int(d.get("price",p["price"])),int(d.get("stock",p["stock"])),pid))
    audit("product","تعديل منتج "+pid); return jsonify(ok=True)

@app.post("/api/products/<pid>/status")
def product_status(pid):
    d=request.get_json() or {}; st=d.get("status")
    if st not in ("published","hidden","archived"): return jsonify(error="حالة غير صحيحة"),400
    execsql("UPDATE products SET status=? WHERE id=?",(st,pid)); audit("product","تغيير حالة منتج "+pid); return jsonify(ok=True)

@app.post("/api/categories")
def add_category():
    d=request.get_json() or {}
    if d.get("type") not in ("booklet","stationery","gift") or not d.get("name"): return jsonify(error="بيانات القسم غير صحيحة"),400
    cid=uid("C"); execsql("INSERT INTO categories(id,type,name,status) VALUES(?,?,?,'active')",(cid,d["type"],d["name"]))
    audit("category","إضافة قسم "+d["name"]); return jsonify(id=cid)

@app.put("/api/categories/<cid>")
def edit_category(cid):
    d=request.get_json() or {}; execsql("UPDATE categories SET name=? WHERE id=?",(d.get("name",""),cid)); audit("category","تعديل قسم "+cid); return jsonify(ok=True)

@app.post("/api/categories/<cid>/status")
def category_status(cid):
    d=request.get_json() or {}; st=d.get("status")
    if st not in ("active","hidden"): return jsonify(error="حالة غير صحيحة"),400
    execsql("UPDATE categories SET status=? WHERE id=?",(st,cid)); return jsonify(ok=True)

@app.post("/api/banners")
def add_banner():
    d=request.get_json() or {}; bid=uid("AD")
    execsql("INSERT INTO banners(id,title,text,active) VALUES(?,?,?,1)",(bid,d.get("title",""),d.get("text","")))
    audit("banner","إضافة إعلان"); return jsonify(id=bid)

@app.put("/api/banners/<bid>")
def edit_banner(bid):
    d=request.get_json() or {}; execsql("UPDATE banners SET title=?,text=? WHERE id=?",(d.get("title",""),d.get("text",""),bid)); return jsonify(ok=True)

@app.post("/api/banners/<bid>/toggle")
def toggle_banner(bid):
    execsql("UPDATE banners SET active=CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id=?",(bid,)); return jsonify(ok=True)

@app.delete("/api/banners/<bid>")
def delete_banner(bid):
    execsql("DELETE FROM banners WHERE id=?",(bid,)); audit("banner","حذف إعلان"); return jsonify(ok=True)

@app.post("/api/withdrawals/<wid>/status")
def withdrawal_status(wid):
    d=request.get_json() or {}; st=d.get("status")
    if st not in ("approved","rejected","paid"): return jsonify(error="حالة غير صحيحة"),400
    execsql("UPDATE withdrawals SET status=? WHERE id=?",(st,wid)); audit("withdrawal","تحديث طلب سحب "+wid); return jsonify(ok=True)

@app.get("/api/backup")
def db_backup():
    if USE_POSTGRES:
        return jsonify(error="النسخة تستخدم Supabase/PostgreSQL. خذ النسخة الاحتياطية من لوحة Supabase."),400
    return send_from_directory(DB.parent,DB.name,as_attachment=True,download_name="alin_backup.db")

init()

if __name__=="__main__":
    app.run(host="0.0.0.0",port=int(os.environ.get("PORT",5000)),debug=False)
