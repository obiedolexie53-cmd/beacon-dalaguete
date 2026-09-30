from fastapi import APIRouter

from app.api import health
from app.auth.router import me_router, resident_auth_router, staff_auth_router
from app.locations.router import router as locations_router
from app.media.router import public_router as media_public_router
from app.media.router import resident_router as media_resident_router
from app.notifications.router import router as notifications_router
from app.reports.router import public_router as reports_public_router
from app.reports.router import resident_router as reports_resident_router
from app.staff.reports import map_router as staff_map_router
from app.staff.reports import router as staff_reports_router
from app.staff.router import router as staff_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(locations_router)
api_router.include_router(resident_auth_router, prefix="/auth", tags=["auth: resident"])
api_router.include_router(staff_auth_router, prefix="/staff/auth", tags=["auth: staff"])
api_router.include_router(me_router)
api_router.include_router(reports_public_router)
api_router.include_router(reports_resident_router)
api_router.include_router(media_resident_router)
api_router.include_router(media_public_router)
api_router.include_router(notifications_router)
api_router.include_router(staff_router)
api_router.include_router(staff_reports_router)
api_router.include_router(staff_map_router)
