from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


# ---------- Auth / Users ----------

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    first_name: Optional[str] = ""
    last_name: Optional[str] = ""
    phone: Optional[str] = ""
    role: str = "member"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: Optional[str]
    first_name: str
    last_name: str
    phone: str
    role: str
    is_active: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Categories / Rooms ----------

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str


class RoomCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class RoomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str


# ---------- Items ----------

class ItemCreate(BaseModel):
    name: str
    brand: Optional[str] = ""
    category_id: Optional[int] = None
    room_id: Optional[int] = None
    unit_type: str = "pieces"
    reorder_threshold: float = 5
    description: Optional[str] = ""


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    brand: str
    category_id: Optional[int]
    room_id: Optional[int]
    unit_type: str
    reorder_threshold: float
    description: str

    # computed fields filled in by the router, not the ORM object directly
    total_quantity: Optional[float] = None
    stock_status: Optional[str] = None
    earliest_expiry: Optional[date] = None
    expiry_status: Optional[str] = None


# ---------- Batches ----------

class BatchCreate(BaseModel):
    item_id: int
    purchase_date: date
    expiry_date: Optional[date] = None
    pack_quantity: float = 1
    units_per_pack: float = 1
    unit_price: float = 0
    notes: Optional[str] = ""


class BatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    item_id: int
    purchase_date: date
    expiry_date: Optional[date]
    pack_quantity: float
    units_per_pack: float
    unit_price: float
    notes: str
    is_active: bool

    total_units: Optional[float] = None
    remaining_units: Optional[float] = None
    total_cost: Optional[float] = None
    expiry_status: Optional[str] = None


# ---------- Withdrawals ----------

class WithdrawalCreate(BaseModel):
    item_id: int
    quantity: float
    purpose: Optional[str] = ""
    notes: Optional[str] = ""


class WithdrawalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    batch_id: int
    user_id: Optional[int]
    quantity_taken: float
    quantity_remaining_after: float
    purpose: str
    notes: str
    withdrawn_at: datetime


# ---------- Restock ----------

class RestockPlanCreate(BaseModel):
    name: str = "Restock Plan"
    notes: Optional[str] = ""


class RestockPlanItemCreate(BaseModel):
    item_id: int
    packs_to_buy: float = 1
    units_per_pack: float = 1
    estimated_price_per_pack: float = 0
    notes: Optional[str] = ""


class RestockPlanItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    plan_id: int
    item_id: int
    packs_to_buy: float
    units_per_pack: float
    estimated_price_per_pack: float
    is_restocked: bool
    actual_price_per_pack: float
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None


class RestockPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    status: str
    notes: str
    created_at: datetime
    total_estimated_cost: Optional[float] = None
    total_restocked_cost: Optional[float] = None
    items: List[RestockPlanItemOut] = []


# ---------- AI Assistant ----------

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


class PendingAction(BaseModel):
    action_type: str  # "withdraw_stock" | "create_batch" | "create_restock_plan"
    description: str  # human-readable confirmation prompt
    params: dict


class ChatResponse(BaseModel):
    reply: str
    pending_action: Optional[PendingAction] = None


class ExecuteActionRequest(BaseModel):
    action_type: str
    params: dict


# ---------- Push Notifications ----------

class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys


