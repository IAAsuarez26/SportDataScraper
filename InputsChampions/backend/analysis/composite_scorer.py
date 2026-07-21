"""
Composite Scorer - Combines all analysis dimensions.
Generates overall team form score from physical, technical, and tactical analyses.
"""
from typing import Dict, Any, List

from .physical_analyzer import PhysicalAnalyzer
from .technical_analyzer import TechnicalAnalyzer
from .tactical_analyzer import TacticalAnalyzer


class CompositeScorer:
    """
    Combines physical, technical, and tactical analyses
    into a comprehensive team form score.
    """
    
    # Weights for overall score (must sum to 1.0)
    DIMENSION_WEIGHTS = {
        "physical": 0.25,
        "technical": 0.40,
        "tactical": 0.35
    }
    
    def __init__(self):
        self.physical_analyzer = PhysicalAnalyzer()
        self.technical_analyzer = TechnicalAnalyzer()
        self.tactical_analyzer = TacticalAnalyzer()
    
    def analyze_team(self, team_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform complete analysis on a team.
        
        Args:
            team_data: Raw team data with stats, injuries, form
            
        Returns:
            Complete analysis with all dimensions and overall score
        """
        # Run all analyzers
        physical = self.physical_analyzer.analyze(team_data)
        technical = self.technical_analyzer.analyze(team_data)
        tactical = self.tactical_analyzer.analyze(team_data)
        
        # Calculate overall score
        overall_score = (
            physical["physical_score"] * self.DIMENSION_WEIGHTS["physical"] +
            technical["technical_score"] * self.DIMENSION_WEIGHTS["technical"] +
            tactical["tactical_score"] * self.DIMENSION_WEIGHTS["tactical"]
        )
        
        # Determine overall status
        overall_status = self._get_overall_status(overall_score)
        
        # Determine strengths and weaknesses
        strengths, weaknesses = self._identify_strengths_weaknesses(
            physical, technical, tactical
        )
        
        return {
            # Basic info
            "team_id": team_data.get("id"),
            "team_name": team_data.get("name"),
            "country": team_data.get("country"),
            
            # Overall
            "overall_score": round(overall_score, 1),
            "overall_status": overall_status,
            "overall_rank": None,  # Will be set when comparing multiple teams
            
            # Dimension scores
            "physical": physical,
            "technical": technical,
            "tactical": tactical,
            
            # Summary insights
            "strengths": strengths,
            "weaknesses": weaknesses,
            "form_trend": self._calculate_form_trend(tactical),
            "readiness": self._calculate_readiness(physical, tactical),
            
            # Metadata
            "last_updated": team_data.get("last_updated")
        }
    
    def analyze_all_teams(self, teams_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Analyze multiple teams and rank them.
        
        Args:
            teams_data: List of team data dictionaries
            
        Returns:
            List of analyzed teams, sorted by overall score
        """
        analyzed = []
        
        for team_data in teams_data:
            analysis = self.analyze_team(team_data)
            analyzed.append(analysis)
        
        # Sort by overall score (descending)
        analyzed.sort(key=lambda x: x["overall_score"], reverse=True)
        
        # Assign ranks
        for idx, team in enumerate(analyzed, 1):
            team["overall_rank"] = idx
        
        return analyzed
    
    def compare_teams(self, team1_data: Dict[str, Any], team2_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compare two teams head-to-head.
        
        Args:
            team1_data: First team data
            team2_data: Second team data
            
        Returns:
            Comparison result with advantage indicators
        """
        team1 = self.analyze_team(team1_data)
        team2 = self.analyze_team(team2_data)
        
        # Determine advantages by dimension
        physical_advantage = "team1" if team1["physical"]["physical_score"] > team2["physical"]["physical_score"] else "team2"
        technical_advantage = "team1" if team1["technical"]["technical_score"] > team2["technical"]["technical_score"] else "team2"
        tactical_advantage = "team1" if team1["tactical"]["tactical_score"] > team2["tactical"]["tactical_score"] else "team2"
        overall_advantage = "team1" if team1["overall_score"] > team2["overall_score"] else "team2"
        
        # Calculate win probability estimate
        score_diff = team1["overall_score"] - team2["overall_score"]
        team1_probability = 50 + (score_diff * 0.4)  # Rough estimate
        team1_probability = max(20, min(80, team1_probability))
        
        return {
            "team1": team1,
            "team2": team2,
            "advantages": {
                "physical": physical_advantage,
                "technical": technical_advantage,
                "tactical": tactical_advantage,
                "overall": overall_advantage
            },
            "score_difference": round(abs(score_diff), 1),
            "probabilities": {
                "team1_win": round(team1_probability, 1),
                "draw": round(25, 1),
                "team2_win": round(100 - team1_probability - 25, 1)
            },
            "prediction": self._generate_prediction(team1, team2, overall_advantage)
        }
    
    def _get_overall_status(self, score: float) -> str:
        """Get overall status label."""
        if score >= 85:
            return "Peak Form"
        elif score >= 75:
            return "Strong Form"
        elif score >= 65:
            return "Good Form"
        elif score >= 55:
            return "Moderate Form"
        elif score >= 45:
            return "Mixed Form"
        else:
            return "Poor Form"
    
    def _identify_strengths_weaknesses(
        self,
        physical: Dict[str, Any],
        technical: Dict[str, Any],
        tactical: Dict[str, Any]
    ) -> tuple:
        """Identify team's main strengths and weaknesses."""
        dimensions = {
            "Physical Condition": physical["physical_score"],
            "Attack": technical["attack_score"],
            "Defense": technical["defense_score"],
            "Possession": technical["possession_score"],
            "Form": tactical["form_score"],
            "Consistency": tactical["consistency_score"]
        }
        
        # Sort by score
        sorted_dims = sorted(dimensions.items(), key=lambda x: x[1], reverse=True)
        
        # Top 2 are strengths, bottom 2 are weaknesses
        strengths = [d[0] for d in sorted_dims[:2] if d[1] >= 65]
        weaknesses = [d[0] for d in sorted_dims[-2:] if d[1] < 60]
        
        return strengths, weaknesses
    
    def _calculate_form_trend(self, tactical: Dict[str, Any]) -> str:
        """Calculate current form trend."""
        momentum = tactical.get("momentum", "Stable")
        form_quality = tactical.get("current_form", "Unknown")
        
        if momentum == "Rising" and form_quality in ["Excellent", "Good"]:
            return "Strong Upward"
        elif momentum == "Rising":
            return "Improving"
        elif momentum == "Declining":
            return "Declining"
        else:
            return "Stable"
    
    def _calculate_readiness(
        self,
        physical: Dict[str, Any],
        tactical: Dict[str, Any]
    ) -> str:
        """Calculate match readiness."""
        physical_status = physical.get("physical_status", "Moderate")
        momentum = tactical.get("momentum", "Stable")
        injuries = physical.get("injuries_count", 0)
        
        # Check for red flags
        if injuries > 5 or physical_status == "Critical":
            return "Concerning"
        
        if physical_status in ["Excellent", "Good"] and momentum == "Rising":
            return "Fully Ready"
        elif physical_status in ["Excellent", "Good"]:
            return "Ready"
        elif momentum != "Declining":
            return "Needs Improvement"
        else:
            return "Uncertain"
    
    def _generate_prediction(
        self,
        team1: Dict[str, Any],
        team2: Dict[str, Any],
        advantage: str
    ) -> str:
        """Generate prediction text."""
        winner = team1 if advantage == "team1" else team2
        loser = team1 if advantage == "team2" else team2
        
        score_diff = abs(team1["overall_score"] - team2["overall_score"])
        
        if score_diff > 15:
            return f"{winner['team_name']} has a significant advantage"
        elif score_diff > 8:
            return f"{winner['team_name']} has a moderate advantage"
        elif score_diff > 3:
            return f"{winner['team_name']} has a slight edge"
        else:
            return "This match is too close to call"
