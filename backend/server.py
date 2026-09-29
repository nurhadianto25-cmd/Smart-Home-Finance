from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
import jwt
import bcrypt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret')
JWT_ALG = 'HS256'
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI(title="Smart Home Finance API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------- Helpers ----------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def create_jwt(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': now_utc() + timedelta(days=7),
        'iat': now_utc(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def new_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(' ', 1)[1]
    # Try JWT first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"user_id": payload['user_id']}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.PyJWTError:
        pass
    # Try emergent session token
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid token")
    exp = session.get('expires_at')
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session['user_id']}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ---------------- Models ----------------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginInput(BaseModel):
    email: EmailStr
    password: str

class SessionInput(BaseModel):
    session_id: str

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None

class AuthResponse(BaseModel):
    token: str
    user: UserOut

class TransactionIn(BaseModel):
    type: Literal['income', 'expense']
    amount: float
    category: str
    title: str
    note: Optional[str] = ''
    date: Optional[str] = None  # ISO string

class TransactionOut(TransactionIn):
    tx_id: str
    created_at: str

class ShoppingIn(BaseModel):
    name: str
    category: str
    budget: float
    realized: float = 0
    status: Literal['belum', 'sebagian', 'selesai'] = 'belum'
    frequency: str = 'Rutin'
    month: str  # YYYY-MM

class ShoppingOut(ShoppingIn):
    item_id: str

class BillIn(BaseModel):
    name: str
    kind: Literal['rutin', 'cicilan', 'pinjaman', 'lainnya'] = 'rutin'
    category: str
    amount: float
    due_date: str  # ISO date
    status: Literal['segera', 'belum', 'terlambat', 'lunas', 'ditangguhkan'] = 'belum'
    note: Optional[str] = ''

class BillOut(BillIn):
    bill_id: str

class SavingsIn(BaseModel):
    name: str
    target: float
    saved: float = 0
    color: Optional[str] = '#10D96A'
    icon: Optional[str] = 'piggy-bank'

class SavingsOut(SavingsIn):
    goal_id: str

class EducationChildIn(BaseModel):
    name: str
    school: str
    grade: str

class EducationChildOut(EducationChildIn):
    child_id: str

class EducationItemIn(BaseModel):
    child_id: str
    name: str
    category: str
    budget: float
    realized: float = 0
    frequency: str = 'Bulanan'
    month: str  # YYYY-MM
    status: Literal['belum', 'sebagian', 'lunas'] = 'belum'

class EducationItemOut(EducationItemIn):
    item_id: str

# ---------------- Auth Routes ----------------
@api_router.post('/auth/register', response_model=AuthResponse)
async def register(body: RegisterInput):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user_id = new_id('user')
    user_doc = {
        "user_id": user_id,
        "email": body.email.lower(),
        "name": body.name,
        "picture": None,
        "password_hash": hash_password(body.password),
        "provider": "password",
        "created_at": now_utc(),
    }
    await db.users.insert_one(user_doc)
    token = create_jwt(user_id)
    return AuthResponse(token=token, user=UserOut(user_id=user_id, email=body.email.lower(), name=body.name))

@api_router.post('/auth/login', response_model=AuthResponse)
async def login(body: LoginInput):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not user.get('password_hash') or not verify_password(body.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    token = create_jwt(user['user_id'])
    return AuthResponse(token=token, user=UserOut(
        user_id=user['user_id'], email=user['email'], name=user['name'], picture=user.get('picture')
    ))

@api_router.post('/auth/session', response_model=AuthResponse)
async def session_exchange(body: SessionInput):
    # Exchange emergent session_id -> session data
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Session tidak valid")
    data = r.json()
    email = (data.get('email') or '').lower()
    name = data.get('name') or email.split('@')[0]
    picture = data.get('picture')
    session_token = data.get('session_token')
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Data sesi tidak lengkap")

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing['user_id']
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = new_id('user')
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "provider": "google",
            "created_at": now_utc(),
        })
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(days=7),
    })
    return AuthResponse(token=session_token, user=UserOut(
        user_id=user_id, email=email, name=name, picture=picture
    ))

@api_router.get('/auth/me', response_model=UserOut)
async def me(user=Depends(get_current_user)):
    return UserOut(user_id=user['user_id'], email=user['email'], name=user['name'], picture=user.get('picture'))

@api_router.post('/auth/logout')
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith('Bearer '):
        token = authorization.split(' ', 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}

# ---------------- Transactions ----------------
@api_router.get('/transactions', response_model=List[TransactionOut])
async def list_transactions(user=Depends(get_current_user), month: Optional[str] = None, type: Optional[str] = None):
    q = {"user_id": user['user_id']}
    if type:
        q['type'] = type
    if month:
        q['month'] = month
    items = await db.transactions.find(q, {"_id": 0, "user_id": 0, "month": 0}).sort([("date", -1), ("created_at", -1)]).to_list(500)
    return items

@api_router.post('/transactions', response_model=TransactionOut)
async def create_transaction(body: TransactionIn, user=Depends(get_current_user)):
    tx_id = new_id('tx')
    date_str = body.date or now_utc().isoformat()
    month = date_str[:7]
    doc = {
        "tx_id": tx_id,
        "user_id": user['user_id'],
        "type": body.type,
        "amount": body.amount,
        "category": body.category,
        "title": body.title,
        "note": body.note or '',
        "date": date_str,
        "month": month,
        "created_at": now_utc().isoformat(),
    }
    await db.transactions.insert_one(doc.copy())
    return {k: v for k, v in doc.items() if k not in ('user_id', 'month')}

@api_router.delete('/transactions/{tx_id}')
async def delete_transaction(tx_id: str, user=Depends(get_current_user)):
    res = await db.transactions.delete_one({"tx_id": tx_id, "user_id": user['user_id']})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}

# ---------------- Shopping ----------------
@api_router.get('/shopping', response_model=List[ShoppingOut])
async def list_shopping(user=Depends(get_current_user), month: Optional[str] = None):
    q = {"user_id": user['user_id']}
    if month:
        q['month'] = month
    items = await db.shopping.find(q, {"_id": 0, "user_id": 0}).to_list(500)
    return items

@api_router.post('/shopping', response_model=ShoppingOut)
async def create_shopping(body: ShoppingIn, user=Depends(get_current_user)):
    item_id = new_id('shp')
    doc = {"item_id": item_id, "user_id": user['user_id'], **body.dict()}
    await db.shopping.insert_one(doc.copy())
    return {k: v for k, v in doc.items() if k != 'user_id'}

@api_router.put('/shopping/{item_id}', response_model=ShoppingOut)
async def update_shopping(item_id: str, body: ShoppingIn, user=Depends(get_current_user)):
    await db.shopping.update_one({"item_id": item_id, "user_id": user['user_id']}, {"$set": body.dict()})
    doc = await db.shopping.find_one({"item_id": item_id, "user_id": user['user_id']}, {"_id": 0, "user_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc

@api_router.delete('/shopping/{item_id}')
async def delete_shopping(item_id: str, user=Depends(get_current_user)):
    res = await db.shopping.delete_one({"item_id": item_id, "user_id": user['user_id']})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}

# ---------------- Bills ----------------
@api_router.get('/bills', response_model=List[BillOut])
async def list_bills(user=Depends(get_current_user)):
    items = await db.bills.find({"user_id": user['user_id']}, {"_id": 0, "user_id": 0}).to_list(500)
    return items

@api_router.post('/bills', response_model=BillOut)
async def create_bill(body: BillIn, user=Depends(get_current_user)):
    bill_id = new_id('bill')
    doc = {"bill_id": bill_id, "user_id": user['user_id'], **body.dict()}
    await db.bills.insert_one(doc.copy())
    return {k: v for k, v in doc.items() if k != 'user_id'}

@api_router.put('/bills/{bill_id}', response_model=BillOut)
async def update_bill(bill_id: str, body: BillIn, user=Depends(get_current_user)):
    await db.bills.update_one({"bill_id": bill_id, "user_id": user['user_id']}, {"$set": body.dict()})
    doc = await db.bills.find_one({"bill_id": bill_id, "user_id": user['user_id']}, {"_id": 0, "user_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc

@api_router.delete('/bills/{bill_id}')
async def delete_bill(bill_id: str, user=Depends(get_current_user)):
    res = await db.bills.delete_one({"bill_id": bill_id, "user_id": user['user_id']})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}

# ---------------- Savings ----------------
@api_router.get('/savings', response_model=List[SavingsOut])
async def list_savings(user=Depends(get_current_user)):
    items = await db.savings.find({"user_id": user['user_id']}, {"_id": 0, "user_id": 0}).to_list(500)
    return items

@api_router.post('/savings', response_model=SavingsOut)
async def create_savings(body: SavingsIn, user=Depends(get_current_user)):
    goal_id = new_id('goal')
    doc = {"goal_id": goal_id, "user_id": user['user_id'], **body.dict()}
    await db.savings.insert_one(doc.copy())
    return {k: v for k, v in doc.items() if k != 'user_id'}

@api_router.put('/savings/{goal_id}', response_model=SavingsOut)
async def update_savings(goal_id: str, body: SavingsIn, user=Depends(get_current_user)):
    await db.savings.update_one({"goal_id": goal_id, "user_id": user['user_id']}, {"$set": body.dict()})
    doc = await db.savings.find_one({"goal_id": goal_id, "user_id": user['user_id']}, {"_id": 0, "user_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc

@api_router.delete('/savings/{goal_id}')
async def delete_savings(goal_id: str, user=Depends(get_current_user)):
    res = await db.savings.delete_one({"goal_id": goal_id, "user_id": user['user_id']})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}

# ---------------- Education ----------------
@api_router.get('/education/children', response_model=List[EducationChildOut])
async def list_children(user=Depends(get_current_user)):
    items = await db.education_children.find({"user_id": user['user_id']}, {"_id": 0, "user_id": 0}).to_list(200)
    return items

@api_router.post('/education/children', response_model=EducationChildOut)
async def create_child(body: EducationChildIn, user=Depends(get_current_user)):
    child_id = new_id('child')
    doc = {"child_id": child_id, "user_id": user['user_id'], **body.dict()}
    await db.education_children.insert_one(doc.copy())
    return {k: v for k, v in doc.items() if k != 'user_id'}

@api_router.delete('/education/children/{child_id}')
async def delete_child(child_id: str, user=Depends(get_current_user)):
    await db.education_children.delete_one({"child_id": child_id, "user_id": user['user_id']})
    await db.education_items.delete_many({"child_id": child_id, "user_id": user['user_id']})
    return {"ok": True}

@api_router.get('/education/items', response_model=List[EducationItemOut])
async def list_edu_items(user=Depends(get_current_user), child_id: Optional[str] = None, month: Optional[str] = None):
    q = {"user_id": user['user_id']}
    if child_id:
        q['child_id'] = child_id
    if month:
        q['month'] = month
    items = await db.education_items.find(q, {"_id": 0, "user_id": 0}).to_list(500)
    return items

@api_router.post('/education/items', response_model=EducationItemOut)
async def create_edu_item(body: EducationItemIn, user=Depends(get_current_user)):
    item_id = new_id('eitem')
    doc = {"item_id": item_id, "user_id": user['user_id'], **body.dict()}
    await db.education_items.insert_one(doc.copy())
    return {k: v for k, v in doc.items() if k != 'user_id'}

@api_router.delete('/education/items/{item_id}')
async def delete_edu_item(item_id: str, user=Depends(get_current_user)):
    await db.education_items.delete_one({"item_id": item_id, "user_id": user['user_id']})
    return {"ok": True}

# ---------------- Dashboard Summary ----------------
@api_router.get('/dashboard/summary')
async def dashboard_summary(user=Depends(get_current_user), month: Optional[str] = None):
    if not month:
        month = now_utc().strftime('%Y-%m')
    txs = await db.transactions.find({"user_id": user['user_id'], "month": month}, {"_id": 0}).to_list(1000)
    income = sum(t['amount'] for t in txs if t['type'] == 'income')
    expense = sum(t['amount'] for t in txs if t['type'] == 'expense')
    balance = income - expense
    saving_rate = round((balance / income) * 100, 1) if income > 0 else 0.0

    # Expense by category
    cat_map = {}
    for t in txs:
        if t['type'] == 'expense':
            cat_map[t['category']] = cat_map.get(t['category'], 0) + t['amount']
    total_exp = sum(cat_map.values()) or 1
    categories = [
        {"category": k, "amount": v, "percent": round(v / total_exp * 100, 1)}
        for k, v in sorted(cat_map.items(), key=lambda x: -x[1])
    ]

    # Cashflow last 6 months
    cashflow = []
    base = datetime.strptime(month + '-01', '%Y-%m-%d')
    for i in range(5, -1, -1):
        y = base.year
        m = base.month - i
        while m <= 0:
            m += 12
            y -= 1
        key = f"{y:04d}-{m:02d}"
        m_txs = await db.transactions.find({"user_id": user['user_id'], "month": key}, {"_id": 0}).to_list(1000)
        cashflow.append({
            "month": key,
            "income": sum(t['amount'] for t in m_txs if t['type'] == 'income'),
            "expense": sum(t['amount'] for t in m_txs if t['type'] == 'expense'),
        })

    # Financial health score
    score = 50
    if income > 0:
        score = min(100, int(50 + (balance / income) * 60))
    if income == 0 and expense == 0:
        score = 0

    # Upcoming bills (next 14 days)
    bills = await db.bills.find({"user_id": user['user_id']}, {"_id": 0, "user_id": 0}).to_list(500)
    upcoming = []
    today = now_utc().date()
    for b in bills:
        if b['status'] in ('lunas',):
            continue
        try:
            d = datetime.fromisoformat(b['due_date']).date()
            days_left = (d - today).days
            if -30 <= days_left <= 30:
                upcoming.append({**b, "days_left": days_left})
        except Exception:
            pass
    upcoming.sort(key=lambda x: x['days_left'])

    # Savings goals
    savings = await db.savings.find({"user_id": user['user_id']}, {"_id": 0, "user_id": 0}).to_list(200)

    # Monthly commitments
    total_bills = sum(b['amount'] for b in bills if b['status'] != 'lunas')

    return {
        "month": month,
        "income": income,
        "expense": expense,
        "balance": balance,
        "saving_rate": saving_rate,
        "health_score": score,
        "expense_by_category": categories,
        "cashflow": cashflow,
        "upcoming_bills": upcoming[:5],
        "savings": savings,
        "total_bills": total_bills,
        "tx_count": len(txs),
    }

# ---------------- AI Insight ----------------
@api_router.get('/insights/generate')
async def generate_insight(user=Depends(get_current_user), month: Optional[str] = None):
    if not month:
        month = now_utc().strftime('%Y-%m')
    txs = await db.transactions.find({"user_id": user['user_id'], "month": month}, {"_id": 0}).to_list(1000)
    income = sum(t['amount'] for t in txs if t['type'] == 'income')
    expense = sum(t['amount'] for t in txs if t['type'] == 'expense')
    cat_map = {}
    for t in txs:
        if t['type'] == 'expense':
            cat_map[t['category']] = cat_map.get(t['category'], 0) + t['amount']

    if income == 0 and expense == 0:
        return {"insight": "Belum ada data transaksi bulan ini. Tambahkan pemasukan dan pengeluaran pertama Anda untuk mendapatkan analisis keuangan yang lebih akurat."}

    summary = (
        f"Bulan {month}: Pemasukan Rp{income:,.0f}, Pengeluaran Rp{expense:,.0f}, "
        f"Selisih Rp{income - expense:,.0f}. Pengeluaran per kategori: "
        + ", ".join([f"{k} Rp{v:,.0f}" for k, v in cat_map.items()])
    )
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"insight_{user['user_id']}_{month}",
            system_message=(
                "Anda adalah asisten keuangan keluarga Indonesia. "
                "Berikan analisis singkat 3-4 kalimat dalam Bahasa Indonesia yang ramah dan actionable. "
                "Sertakan satu rekomendasi konkret untuk menghemat. "
                "Gunakan format Rupiah (Rp). Jangan pakai markdown."
            ),
        ).with_model("anthropic", "claude-sonnet-5")
        reply = await chat.send_message(UserMessage(text=f"Analisa data keuangan berikut: {summary}"))
        return {"insight": reply}
    except Exception as e:
        logger.warning(f"AI insight failed: {e}")
        # Rule-based fallback
        top_cat = max(cat_map.items(), key=lambda x: x[1]) if cat_map else None
        if income > expense:
            base = f"Keuangan Anda dalam kondisi baik. Selisih pemasukan Rp{income - expense:,.0f} bulan ini."
        else:
            base = f"Perhatian: Pengeluaran melebihi pemasukan sebesar Rp{expense - income:,.0f} bulan ini."
        if top_cat:
            base += f" Kategori '{top_cat[0]}' menjadi pengeluaran terbesar (Rp{top_cat[1]:,.0f}). Coba tinjau ulang kategori ini untuk menghemat."
        return {"insight": base}

# ---------------- App Wiring ----------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.transactions.create_index([("user_id", 1), ("month", 1)])
    await db.bills.create_index("user_id")
    await db.shopping.create_index([("user_id", 1), ("month", 1)])
    await db.savings.create_index("user_id")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
