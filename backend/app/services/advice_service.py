from typing import List, Dict, Any
from app.schemas.risk import AdviceItem

def generate_advice(prediction: Dict[str, Any]) -> List[Dict[str, Any]]:
    advice = []
    
    # 1. Band-based advice
    risk_band = prediction.get("risk_band", "")
    if risk_band in ["High", "Very High"]:
        advice.append({
            "title": "Consider Secured Lending",
            "body": "Based on the overall risk profile, you might have better approval odds and lower rates if you provide collateral (like a fixed deposit or property) for a secured loan.",
            "priority": "High",
            "category": "General"
        })
    elif risk_band == "Moderate":
        advice.append({
            "title": "Improve Credit Utilization",
            "body": "Your profile is moderately strong. Paying down small existing debts could bump you into a lower risk category.",
            "priority": "Medium",
            "category": "General"
        })
    elif risk_band in ["Low", "Very Low"]:
        advice.append({
            "title": "Negotiate Rates",
            "body": "Your risk profile is excellent. You are in a strong position to negotiate lower interest rates with lenders.",
            "priority": "Low",
            "category": "General"
        })
        
    # 2. Affordability-based advice
    affordability = prediction.get("affordability", {})
    flags = affordability.get("flags", [])
    
    for flag in flags:
        if "EMIs exceed 50%" in flag:
            advice.append({
                "title": "Debt Consolidation",
                "body": "Your existing EMIs take up more than half your income. Consider a debt consolidation loan to lower your monthly payments before taking on new debt.",
                "priority": "High",
                "category": "Affordability"
            })
        elif "EMIs are above the 40%" in flag:
            advice.append({
                "title": "Monitor Debt Burden",
                "body": "Your EMIs are approaching the comfortable limit. Ensure any new loan fits comfortably within your budget without straining cash flow.",
                "priority": "Medium",
                "category": "Affordability"
            })
        elif "Monthly outflow exceeds income" in flag:
            advice.append({
                "title": "Reduce Expenses",
                "body": "Your current monthly expenses and EMIs exceed your income. You must reduce expenditures before taking on additional credit.",
                "priority": "Critical",
                "category": "Affordability"
            })
        elif "Emergency fund covers under 3 months" in flag:
            advice.append({
                "title": "Build Emergency Savings",
                "body": "Try to build savings that can cover at least 3-6 months of expenses to protect against unexpected financial shocks.",
                "priority": "Medium",
                "category": "Savings"
            })
            
    return advice
