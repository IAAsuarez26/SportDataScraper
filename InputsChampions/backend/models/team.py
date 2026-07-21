"""
Pydantic models for Team data.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class TeamForm(BaseModel):
    """Team's recent form data."""
    last_5_results: List[str] = Field(default_factory=list, description="W/D/L for last 5 matches")
    wins: int = 0
    draws: int = 0
    losses: int = 0
    goals_scored: int = 0
    goals_conceded: int = 0
    points: int = 0
    form_score: float = 0.0  # 0-100 score


class TeamAnalysis(BaseModel):
    """Complete analysis scores for a team."""
    # Physical metrics
    physical_score: float = Field(default=0.0, ge=0, le=100)
    injuries_count: int = 0
    key_players_available_pct: float = 100.0
    rest_days: int = 0
    fatigue_index: float = 0.0
    
    # Technical metrics
    technical_score: float = Field(default=0.0, ge=0, le=100)
    goals_per_match: float = 0.0
    goals_conceded_per_match: float = 0.0
    xg: float = 0.0
    xga: float = 0.0
    possession_avg: float = 0.0
    pass_accuracy: float = 0.0
    shot_accuracy: float = 0.0
    clean_sheets: int = 0
    
    # Tactical metrics
    tactical_score: float = Field(default=0.0, ge=0, le=100)
    preferred_formation: str = "4-3-3"
    home_performance: float = 0.0
    away_performance: float = 0.0
    pressing_intensity: float = 0.0
    defensive_solidity: float = 0.0
    offensive_efficiency: float = 0.0
    
    # Composite
    overall_score: float = Field(default=0.0, ge=0, le=100)
    
    def calculate_overall(self) -> float:
        """Calculate weighted overall score."""
        self.overall_score = (
            self.physical_score * 0.25 +
            self.technical_score * 0.40 +
            self.tactical_score * 0.35
        )
        return self.overall_score


class Team(BaseModel):
    """Champions League team model."""
    id: str
    name: str
    short_name: str
    country: str
    logo_url: Optional[str] = None
    
    # Competition data
    ucl_position: int = 0
    ucl_points: int = 0
    ucl_played: int = 0
    ucl_won: int = 0
    ucl_drawn: int = 0
    ucl_lost: int = 0
    ucl_gf: int = 0
    ucl_ga: int = 0
    ucl_gd: int = 0
    
    # Form and analysis
    form: TeamForm = Field(default_factory=TeamForm)
    analysis: TeamAnalysis = Field(default_factory=TeamAnalysis)
    
    # Metadata
    last_updated: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
