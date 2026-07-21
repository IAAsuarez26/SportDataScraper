"""
Champions League Analysis API
FastAPI backend for UCL team form analysis and predictions.
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import asyncio

from scrapers import DataAggregator
from analysis import CompositeScorer, MatchPredictor


# Initialize FastAPI app
app = FastAPI(
    title="UEFA Champions League Analysis API",
    description="API for analyzing team form and predicting Champions League matches",
    version="1.0.0"
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
aggregator = DataAggregator(use_cache=True)
scorer = CompositeScorer()
predictor = MatchPredictor()


# Request/Response models
class CompareRequest(BaseModel):
    team_ids: List[str]


class PredictRequest(BaseModel):
    home_team_id: str
    away_team_id: str


# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/")
async def root():
    """API root endpoint."""
    return {
        "name": "UEFA Champions League Analysis API",
        "version": "1.0.0",
        "endpoints": {
            "teams": "/api/teams",
            "team_detail": "/api/teams/{team_id}",
            "rankings": "/api/rankings",
            "fixtures": "/api/fixtures",
            "compare": "/api/compare",
            "predict": "/api/predict",
            "refresh": "/api/refresh"
        }
    }


@app.get("/api/teams")
async def get_all_teams():
    """
    Get all Champions League teams with basic info.
    Returns list of 36 teams with summary data.
    """
    try:
        # Check for cached data first
        cached = aggregator.get_cached_aggregated_data()
        if cached and cached.get("teams"):
            return {
                "total": len(cached["teams"]),
                "teams": cached["teams"],
                "last_updated": cached.get("last_updated")
            }
        
        # Fetch fresh data
        teams = await aggregator.get_all_teams()
        
        return {
            "total": len(teams),
            "teams": teams,
            "last_updated": None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/teams/{team_id}")
async def get_team_detail(team_id: str):
    """
    Get detailed analysis for a specific team.
    Includes physical, technical, and tactical breakdown.
    """
    try:
        # Get full team data
        team_data = await aggregator.get_team_full_analysis(team_id)
        
        if not team_data:
            raise HTTPException(status_code=404, detail=f"Team not found: {team_id}")
        
        # Run complete analysis
        analysis = scorer.analyze_team(team_data)
        
        return {
            "team": team_data,
            "analysis": analysis
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rankings")
async def get_rankings(
    sort_by: str = Query("overall", description="Sort by: overall, physical, technical, tactical"),
    limit: int = Query(36, description="Number of teams to return")
):
    """
    Get team rankings by form score.
    Can sort by overall score or individual dimensions.
    """
    try:
        # Get all teams
        cached = aggregator.get_cached_aggregated_data()
        if cached and cached.get("teams"):
            teams_data = cached["teams"]
        else:
            teams_data = await aggregator.get_all_teams()
        
        # Analyze all teams
        analyzed = scorer.analyze_all_teams(teams_data)
        
        # Sort by requested dimension
        if sort_by == "physical":
            analyzed.sort(key=lambda x: x["physical"]["physical_score"], reverse=True)
        elif sort_by == "technical":
            analyzed.sort(key=lambda x: x["technical"]["technical_score"], reverse=True)
        elif sort_by == "tactical":
            analyzed.sort(key=lambda x: x["tactical"]["tactical_score"], reverse=True)
        # Default is already sorted by overall
        
        # Limit results
        analyzed = analyzed[:limit]
        
        # Update ranks after sorting
        for idx, team in enumerate(analyzed, 1):
            team[f"{sort_by}_rank"] = idx
        
        return {
            "sort_by": sort_by,
            "total": len(analyzed),
            "rankings": analyzed
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/fixtures")
async def get_fixtures():
    """
    Get upcoming Champions League fixtures with predictions.
    """
    try:
        fixtures = await aggregator.get_all_fixtures()
        
        # Get team data for predictions
        cached = aggregator.get_cached_aggregated_data()
        teams_data = cached.get("teams", []) if cached else await aggregator.get_all_teams()
        
        # Create teams lookup
        teams_lookup = {t.get("id"): t for t in teams_data}
        
        # Generate predictions for fixtures
        predictions = predictor.predict_fixtures(fixtures, teams_lookup)
        
        return {
            "total": len(fixtures),
            "fixtures": predictions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/compare")
async def compare_teams(request: CompareRequest):
    """
    Compare multiple teams head-to-head.
    """
    try:
        if len(request.team_ids) < 2:
            raise HTTPException(status_code=400, detail="At least 2 teams required")
        
        # Get team data
        teams_data = []
        for team_id in request.team_ids:
            team = await aggregator.get_team_full_analysis(team_id)
            if team:
                teams_data.append(team)
        
        if len(teams_data) < 2:
            raise HTTPException(status_code=404, detail="Not enough teams found")
        
        # Analyze teams
        analyzed = scorer.analyze_all_teams(teams_data)
        
        # If exactly 2 teams, include direct comparison
        if len(analyzed) == 2:
            comparison = scorer.compare_teams(teams_data[0], teams_data[1])
            return {
                "teams": analyzed,
                "direct_comparison": comparison
            }
        
        return {
            "teams": analyzed
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/predict")
async def predict_match(request: PredictRequest):
    """
    Predict outcome of a match between two teams.
    """
    try:
        # Get team data
        home_team = await aggregator.get_team_full_analysis(request.home_team_id)
        away_team = await aggregator.get_team_full_analysis(request.away_team_id)
        
        if not home_team:
            raise HTTPException(status_code=404, detail=f"Home team not found: {request.home_team_id}")
        if not away_team:
            raise HTTPException(status_code=404, detail=f"Away team not found: {request.away_team_id}")
        
        # Generate prediction
        prediction = predictor.predict_match(home_team, away_team)
        
        return prediction
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/refresh")
async def refresh_data():
    """
    Refresh all data from sources.
    Clears cache and fetches fresh data.
    """
    try:
        result = await aggregator.refresh_all_data()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/standings")
async def get_standings():
    """
    Get current Champions League standings.
    """
    try:
        standings = await aggregator.get_standings()
        return {
            "total": len(standings),
            "standings": standings
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
