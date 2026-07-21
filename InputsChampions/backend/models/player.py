"""
Pydantic models for Player data.
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date


class PlayerInjury(BaseModel):
    """Player injury information."""
    player_name: str
    injury_type: str
    expected_return: Optional[date] = None
    status: str = "Out"  # Out, Doubtful, Questionable
    

class Player(BaseModel):
    """Player model with basic info and status."""
    id: str
    name: str
    team_id: str
    position: str
    shirt_number: Optional[int] = None
    nationality: str = ""
    age: Optional[int] = None
    
    # Status
    is_injured: bool = False
    injury: Optional[PlayerInjury] = None
    is_suspended: bool = False
    
    # Stats
    appearances: int = 0
    goals: int = 0
    assists: int = 0
    minutes_played: int = 0
    yellow_cards: int = 0
    red_cards: int = 0
    
    # Rating
    average_rating: float = 0.0
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }
