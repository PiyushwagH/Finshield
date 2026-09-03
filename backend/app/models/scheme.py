import uuid
from sqlalchemy import Column, String, Integer, Numeric, Enum, ForeignKey, DateTime, Text, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database import Base

class Scheme(Base):
    __tablename__ = "schemes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    short_description = Column(String, nullable=True)
    full_description = Column(Text, nullable=True)
    ministry = Column(String, nullable=True)
    category = Column(Enum('education', 'health', 'agriculture', 'business', name='scheme_categories'), nullable=True)
    level = Column(Enum('central', 'state', name='scheme_levels'), nullable=True)
    state = Column(String, nullable=True)
    benefit_type = Column(Enum('cash', 'subsidy', 'insurance', 'loan', 'other', name='benefit_types'), nullable=True)
    benefit_amount = Column(Numeric, nullable=True)
    benefit_description = Column(String, nullable=True)
    official_url = Column(String, nullable=True)
    application_mode = Column(String, nullable=True)
    required_documents = Column(JSONB, nullable=True)
    status = Column(Enum('draft', 'active', 'archived', 'needs_review', name='scheme_statuses'), nullable=False)
    source_url = Column(String, nullable=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index('ix_schemes_status_category', 'status', 'category'),
    )

class SchemeEligibilityRule(Base):
    __tablename__ = "scheme_eligibility_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scheme_id = Column(UUID(as_uuid=True), ForeignKey("schemes.id"), nullable=False)
    field = Column(String, nullable=False)
    operator = Column(Enum('eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'in', 'not_in', name='rule_operators'), nullable=False)
    value = Column(JSONB, nullable=False)
    logic_group = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('ix_scheme_eligibility_rules_scheme_id', 'scheme_id'),
    )

class UserScheme(Base):
    __tablename__ = "user_schemes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    scheme_id = Column(UUID(as_uuid=True), ForeignKey("schemes.id"), nullable=False)
    status = Column(Enum('saved', 'documents_ready', 'applied', 'under_review', 'approved', 'rejected', name='user_scheme_statuses'), nullable=False)
    notes = Column(Text, nullable=True)
    application_number = Column(String, nullable=True)
    saved_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'scheme_id', name='uq_user_scheme'),
        Index('ix_user_schemes_user_id', 'user_id'),
    )

class SchemeUpdate(Base):
    __tablename__ = "scheme_updates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scheme_id = Column(UUID(as_uuid=True), ForeignKey("schemes.id"), nullable=False)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    source_url = Column(String, nullable=True)
    field_changes = Column(JSONB, nullable=False)
    status = Column(Enum('pending', 'approved', 'rejected', name='update_statuses'), nullable=False)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
