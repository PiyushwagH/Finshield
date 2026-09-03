import uuid
from sqlalchemy import Column, String, Float, Integer, ForeignKey, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from app.database import Base

JSONVariant = JSON().with_variant(JSONB, 'postgresql')

class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    input_data = Column(JSONVariant, nullable=False)
    default_probability = Column(Float, nullable=False)
    risk_band = Column(String, nullable=False)
    risk_score = Column(Integer, nullable=False)
    population_percentile = Column(Float, nullable=False)
    affordability = Column(JSONVariant, nullable=False)
    factors = Column(JSONVariant, nullable=False)
    model_version = Column(String, nullable=False)

    __table_args__ = (
        Index('ix_assessments_user_id_created_at', 'user_id', 'created_at', postgresql_ops={'created_at': 'DESC'}),
    )
