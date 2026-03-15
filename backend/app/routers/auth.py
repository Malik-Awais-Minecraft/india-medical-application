import os
import random
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from dotenv import load_dotenv
from app.database import get_db
from app import models

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

router = APIRouter(prefix="/auth", tags=["Auth"])

# In-memory OTP store: { email: { otp, expires_at, full_name, password } }
_otp_store: dict = {}


# ---------- Schemas ----------
class RegisterRequest(BaseModel):
    email: str
    full_name: str
    password: str

class OTPVerifyRequest(BaseModel):
    email: str
    otp: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str


# ---------- Helpers ----------
def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exc
    return user

def send_otp_email(to_email: str, otp: str, full_name: str):
    """Send OTP via SMTP. Falls back to console print if SMTP not configured."""
    if not SMTP_USER or SMTP_USER == "your-email@gmail.com":
        # Dev fallback — print to console
        print(f"\n{'='*40}\nOTP for {to_email}: {otp}\n{'='*40}\n")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your Residency Companion OTP"
    msg["From"] = SMTP_USER
    msg["To"] = to_email

    html = f"""
    <html><body style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
      <h2 style="color:#4f46e5">Residency Companion</h2>
      <p>Hi {full_name},</p>
      <p>Your one-time password to complete registration is:</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#4f46e5;
                  background:#eef2ff;padding:20px;border-radius:8px;text-align:center">
        {otp}
      </div>
      <p style="color:#888;font-size:12px;margin-top:16px">
        This OTP expires in 10 minutes. Do not share it with anyone.
      </p>
    </body></html>
    """
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
    except Exception as e:
        print(f"[WARN] Email send failed: {e}")
        print(f"OTP for {to_email}: {otp}")


# ---------- Endpoints ----------

@router.post("/send-otp")
def send_otp(req: RegisterRequest, db: Session = Depends(get_db)):
    """Step 1 of registration: validate details and send OTP to email."""
    if db.query(models.User).filter(models.User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered.")

    otp = str(random.randint(100000, 999999))
    _otp_store[req.email] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
        "full_name": req.full_name,
        "password": req.password,
    }

    send_otp_email(req.email, otp, req.full_name)
    return {"message": f"OTP sent to {req.email}. Check your inbox (or server console in dev mode)."}


@router.post("/verify-otp", response_model=UserOut, status_code=201)
def verify_otp(req: OTPVerifyRequest, db: Session = Depends(get_db)):
    """Step 2 of registration: verify OTP and create the account."""
    entry = _otp_store.get(req.email)
    if not entry:
        raise HTTPException(status_code=400, detail="No OTP found for this email. Please start again.")
    if datetime.utcnow() > entry["expires_at"]:
        del _otp_store[req.email]
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
    if entry["otp"] != req.otp.strip():
        raise HTTPException(status_code=400, detail="Incorrect OTP. Please try again.")

    # OTP correct — create the user
    user = models.User(
        email=req.email,
        full_name=entry["full_name"],
        hashed_password=hash_password(entry["password"]),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    del _otp_store[req.email]
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    token = create_access_token(data={"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user
