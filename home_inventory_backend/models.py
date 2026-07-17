from datetime import date, timedelta
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Numeric, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class RoleEnum(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    member = "member"


class StatusEnum(str, enum.Enum):
    draft = "draft"
    shopping = "shopping"
    done = "done"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(150), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=True)
    first_name = Column(String(100), default="")
    last_name = Column(String(100), default="")
    phone = Column(String(30), default="")
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(RoleEnum), default=RoleEnum.member, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    withdrawals = relationship("WithdrawalLog", back_populates="user")
    batches_added = relationship("Batch", back_populates="added_by")
    push_subscriptions = relationship("PushSubscription", back_populates="user", cascade="all, delete-orphan")
    restock_plans = relationship("RestockPlan", back_populates="created_by")

    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username

    def is_admin(self):
        return self.role == RoleEnum.admin

    def is_manager(self):
        return self.role in [RoleEnum.admin, RoleEnum.manager]

    def __str__(self):
        return self.full_name()


class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    items = relationship("Item", back_populates="category")

    def __str__(self):
        return self.name


class Room(Base):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    items = relationship("Item", back_populates="room")

    def __str__(self):
        return self.name


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    brand = Column(String(200), default="")
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    unit_type = Column(String(30), default="pieces")
    reorder_threshold = Column(Numeric(10, 2), default=5)
    description = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category = relationship("Category", back_populates="items")
    room = relationship("Room", back_populates="items")
    batches = relationship("Batch", back_populates="item", cascade="all, delete-orphan")

    def display_name(self):
        return f"{self.brand} — {self.name}" if self.brand else self.name

    def __str__(self):
        return self.display_name()

    def total_quantity(self):
        """Sum of remaining units across all active batches."""
        return sum(b.remaining_units() for b in self.batches if b.is_active)

    def stock_status(self):
        total = self.total_quantity()
        thresh = float(self.reorder_threshold)
        if total <= 0:
            return "out"
        elif total <= thresh:
            return "low"
        elif total <= thresh * 2:
            return "moderate"
        return "good"

    def earliest_expiry(self):
        active_with_expiry = [b for b in self.batches if b.is_active and b.expiry_date]
        if not active_with_expiry:
            return None
        return min(b.expiry_date for b in active_with_expiry)

    def expiry_status(self):
        exp = self.earliest_expiry()
        if not exp:
            return "none"
        today = date.today()
        if exp < today:
            return "expired"
        elif exp <= today + timedelta(days=7):
            return "critical"
        elif exp <= today + timedelta(days=30):
            return "warning"
        return "ok"


class Batch(Base):
    __tablename__ = "batches"
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    purchase_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=True)
    pack_quantity = Column(Numeric(10, 2), default=1)
    units_per_pack = Column(Numeric(10, 2), default=1)
    unit_price = Column(Numeric(12, 2), default=0)
    notes = Column(Text, default="")
    is_active = Column(Boolean, default=True)
    added_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    item = relationship("Item", back_populates="batches")
    added_by = relationship("User", back_populates="batches_added")
    withdrawals = relationship("WithdrawalLog", back_populates="batch", cascade="all, delete-orphan")

    def __str__(self):
        return f"Batch #{self.id}"

    def total_units(self):
        return float(self.pack_quantity) * float(self.units_per_pack)

    def units_withdrawn(self):
        return sum(float(w.quantity_taken) for w in self.withdrawals)

    def remaining_units(self):
        return max(0, self.total_units() - self.units_withdrawn())

    def total_cost(self):
        return float(self.pack_quantity) * float(self.unit_price)

    def expiry_status(self):
        if not self.expiry_date:
            return "none"
        today = date.today()
        if self.expiry_date < today:
            return "expired"
        elif self.expiry_date <= today + timedelta(days=7):
            return "critical"
        elif self.expiry_date <= today + timedelta(days=30):
            return "warning"
        return "ok"


class WithdrawalLog(Base):
    __tablename__ = "withdrawal_logs"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    quantity_taken = Column(Numeric(10, 2), nullable=False)
    quantity_remaining_after = Column(Numeric(10, 2), nullable=False)
    purpose = Column(String(255), default="")
    notes = Column(Text, default="")
    withdrawn_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("Batch", back_populates="withdrawals")
    user = relationship("User", back_populates="withdrawals")


class RestockPlan(Base):
    __tablename__ = "restock_plans"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), default="Restock Plan")
    status = Column(SAEnum(StatusEnum), default=StatusEnum.draft)
    notes = Column(Text, default="")
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by = relationship("User", back_populates="restock_plans")
    items = relationship("RestockPlanItem", back_populates="plan", cascade="all, delete-orphan")

    def __str__(self):
        return self.name

    def total_estimated_cost(self):
        return sum(i.estimated_cost() for i in self.items)

    def total_restocked_cost(self):
        return sum(i.actual_cost() for i in self.items if i.is_restocked)


class RestockPlanItem(Base):
    __tablename__ = "restock_plan_items"
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("restock_plans.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    packs_to_buy = Column(Numeric(10, 2), default=1)
    units_per_pack = Column(Numeric(10, 2), default=1)
    estimated_price_per_pack = Column(Numeric(12, 2), default=0)
    is_restocked = Column(Boolean, default=False)
    restocked_at = Column(DateTime(timezone=True), nullable=True)
    actual_purchase_date = Column(Date, nullable=True)
    actual_expiry_date = Column(Date, nullable=True)
    actual_price_per_pack = Column(Numeric(12, 2), default=0)
    notes = Column(Text, default="")

    plan = relationship("RestockPlan", back_populates="items")
    item = relationship("Item")

    def estimated_cost(self):
        return float(self.packs_to_buy) * float(self.estimated_price_per_pack)

    def actual_cost(self):
        return float(self.packs_to_buy) * float(self.actual_price_per_pack)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    endpoint = Column(Text, nullable=False)
    p256dh = Column(Text, nullable=False)
    auth = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="push_subscriptions")
