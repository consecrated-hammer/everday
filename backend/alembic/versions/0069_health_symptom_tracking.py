"""add headache and medication tracking
Revision ID: 0069_health_symptom_tracking
Revises: 0068_health_sleep_metric_source
"""
from alembic import op
import sqlalchemy as sa
revision = "0069_health_symptom_tracking"
down_revision = "0068_health_sleep_metric_source"
branch_labels = None
depends_on = None
def upgrade():
    op.create_table("headache_events", sa.Column("HeadacheEventId", sa.String(36), primary_key=True), sa.Column("UserId", sa.Integer, nullable=False), sa.Column("LogDate", sa.Date, nullable=False), sa.Column("OnsetAt", sa.DateTime(timezone=True)), sa.Column("EventType", sa.String(30), nullable=False), sa.Column("Severity", sa.Integer), sa.Column("Location", sa.String(200)), sa.Column("ContextNotes", sa.Text), sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False), sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False), schema="health")
    op.create_table("medication_doses", sa.Column("MedicationDoseId", sa.String(36), primary_key=True), sa.Column("UserId", sa.Integer, nullable=False), sa.Column("LogDate", sa.Date, nullable=False), sa.Column("HeadacheEventId", sa.String(36)), sa.Column("TakenAt", sa.DateTime(timezone=True)), sa.Column("MedicationName", sa.String(200), nullable=False), sa.Column("Dose", sa.String(120)), sa.Column("Notes", sa.Text), sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False), sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False), schema="health")
    op.execute("""INSERT INTO health.headache_events (HeadacheEventId,UserId,LogDate,OnsetAt,EventType,Severity,Location,ContextNotes,CreatedAt,UpdatedAt) SELECT 'e7c9f0b5-2a16-4ce8-9a50-202607200001',2,'2026-07-20','2026-07-20T11:00:00','headache',3,'Left temple','Distinct from typical right-temple migraine. Hydralyte + greens at lunch and about 1L water before onset.',SYSUTCDATETIME(),SYSUTCDATETIME() WHERE NOT EXISTS (SELECT 1 FROM health.headache_events WHERE UserId=2 AND LogDate='2026-07-20' AND Location='Left temple'); INSERT INTO health.medication_doses (MedicationDoseId,UserId,LogDate,TakenAt,MedicationName,Dose,Notes,CreatedAt,UpdatedAt) SELECT 'a7c9f0b5-2a16-4ce8-9a50-202607200001',2,'2026-07-20','2026-07-20T13:30:00','Panadol',NULL,'Linked to the 20 July headache.',SYSUTCDATETIME(),SYSUTCDATETIME() WHERE NOT EXISTS (SELECT 1 FROM health.medication_doses WHERE UserId=2 AND LogDate='2026-07-20' AND MedicationName='Panadol');""")
def downgrade():
    op.drop_table("medication_doses", schema="health"); op.drop_table("headache_events", schema="health")
