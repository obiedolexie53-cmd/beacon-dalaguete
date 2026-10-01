"""Report sources (resident / import), import batches and per-prefix reference counters.

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-30 22:58:47.785703
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


report_source = sa.Enum("resident", "import", name="report_source")


def upgrade() -> None:
    op.create_table(
        "import_batches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("filename", sa.String(length=200), nullable=False),
        sa.Column("imported_by_id", sa.Uuid(), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["imported_by_id"],
            ["users.id"],
            name=op.f("fk_import_batches_imported_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_import_batches")),
    )

    # Reference counters become per prefix (BEA = resident reports, IMP = imports).
    op.add_column(
        "report_sequences",
        sa.Column("prefix", sa.String(length=3), server_default="BEA", nullable=False),
    )
    op.drop_constraint("pk_report_sequences", "report_sequences", type_="primary")
    op.create_primary_key("pk_report_sequences", "report_sequences", ["prefix", "year"])

    report_source.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "reports",
        sa.Column("source", report_source, server_default="resident", nullable=False),
    )
    op.add_column("reports", sa.Column("import_batch_id", sa.Uuid(), nullable=True))
    op.add_column("reports", sa.Column("external_ref", sa.String(length=60), nullable=True))
    op.alter_column("reports", "reporter_id", existing_type=sa.UUID(), nullable=True)
    op.create_check_constraint(
        op.f("ck_reports_resident_reports_have_reporter"),
        "reports",
        "source <> 'resident' OR reporter_id IS NOT NULL",
    )
    op.create_index(op.f("ix_reports_import_batch_id"), "reports", ["import_batch_id"])
    op.create_index(op.f("ix_reports_source"), "reports", ["source"])
    op.create_foreign_key(
        op.f("fk_reports_import_batch_id_import_batches"),
        "reports",
        "import_batches",
        ["import_batch_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # Imported records have no reporter, so they cannot survive the downgrade.
    op.execute("DELETE FROM reports WHERE source = 'import'")
    op.drop_constraint(
        op.f("fk_reports_import_batch_id_import_batches"), "reports", type_="foreignkey"
    )
    op.drop_index(op.f("ix_reports_source"), table_name="reports")
    op.drop_index(op.f("ix_reports_import_batch_id"), table_name="reports")
    op.drop_constraint(op.f("ck_reports_resident_reports_have_reporter"), "reports", type_="check")
    op.alter_column("reports", "reporter_id", existing_type=sa.UUID(), nullable=False)
    op.drop_column("reports", "external_ref")
    op.drop_column("reports", "import_batch_id")
    op.drop_column("reports", "source")
    report_source.drop(op.get_bind(), checkfirst=True)

    op.execute("DELETE FROM report_sequences WHERE prefix <> 'BEA'")
    op.drop_constraint("pk_report_sequences", "report_sequences", type_="primary")
    op.create_primary_key("pk_report_sequences", "report_sequences", ["year"])
    op.drop_column("report_sequences", "prefix")
    op.drop_table("import_batches")
