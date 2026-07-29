from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from models.report import ReportStatus


class ReportCreate(BaseModel):
    statement:     str
    offender_name: Optional[str]       = None
    incident_date: Optional[datetime]  = None
    incident_type: Optional[str]       = None
    photo_urls:    Optional[List[str]] = []
    latitude:      Optional[float]     = None
    longitude:     Optional[float]     = None
    address:       Optional[str]       = None


class ReportResponse(BaseModel):
    id:             int
    user_id:        int
    statement:      str
    offender_name:  Optional[str]      = None
    incident_date:  Optional[datetime] = None
    incident_type:  Optional[str]      = None
    photo_urls:     List[str]
    latitude:       Optional[float]
    longitude:      Optional[float]
    address:        Optional[str]
    status:         ReportStatus
    status_display: Optional[str]      = None
    has_status_update: Optional[bool]  = False
    created_at:     datetime
    updated_at:     datetime

    model_config = {"from_attributes": True}


class ReportListItem(BaseModel):
    id:             int
    statement:      str
    offender_name:  Optional[str]      = None
    incident_date:  Optional[datetime] = None
    incident_type:  Optional[str]      = None
    status:         ReportStatus
    status_display: Optional[str]      = None
    has_status_update: Optional[bool]  = False
    created_at:     datetime

    model_config = {"from_attributes": True}
