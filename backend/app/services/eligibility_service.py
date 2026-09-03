from typing import List, Dict, Any

def evaluate_operator(user_value: Any, operator: str, rule_value: Any) -> bool:
    if user_value is None:
        return False
        
    try:
        if operator == 'eq':
            return user_value == rule_value
        elif operator == 'neq':
            return user_value != rule_value
        elif operator == 'lt':
            return float(user_value) < float(rule_value)
        elif operator == 'lte':
            return float(user_value) <= float(rule_value)
        elif operator == 'gt':
            return float(user_value) > float(rule_value)
        elif operator == 'gte':
            return float(user_value) >= float(rule_value)
        elif operator == 'between':
            return float(rule_value[0]) <= float(user_value) <= float(rule_value[1])
        elif operator == 'in':
            if isinstance(user_value, list):
                # If user value is a list (e.g. tags), check if ANY intersect with rule_value
                return bool(set(user_value) & set(rule_value))
            return user_value in rule_value
        elif operator == 'not_in':
            if isinstance(user_value, list):
                return not bool(set(user_value) & set(rule_value))
            return user_value not in rule_value
    except (ValueError, TypeError):
        return False
    return False

def evaluate_scheme(profile: dict, rules: List[Any]) -> dict:
    """
    Evaluates a single scheme's rules against a user profile.
    Returns:
    {
      "is_eligible": bool,
      "groups_passed": [int],
      "criteria": [
         {
           "field": "str", 
           "passed": bool, 
           "user_value": Any, 
           "operator": "str", 
           "rule_value": Any, 
           "logic_group": int
         }
      ]
    }
    """
    if not rules:
        return {
            "is_eligible": True, # If no rules, implicitly eligible
            "groups_passed": [],
            "criteria": []
        }

    criteria = []
    # Group rules by logic_group
    groups: Dict[int, List[dict]] = {}
    
    for r in rules:
        group_id = r.logic_group
        if group_id not in groups:
            groups[group_id] = []
        
        user_value = profile.get(r.field)
        passed = evaluate_operator(user_value, r.operator, r.value)
        
        criterion_result = {
            "field": r.field,
            "passed": passed,
            "user_value": user_value,
            "operator": r.operator,
            "rule_value": r.value,
            "logic_group": group_id
        }
        criteria.append(criterion_result)
        groups[group_id].append(criterion_result)
        
    groups_passed = []
    for group_id, group_criteria in groups.items():
        # A group passes if ALL criteria in it pass (AND logic)
        if all(c["passed"] for c in group_criteria):
            groups_passed.append(group_id)
            
    # The scheme passes if ANY logic group passes (OR logic)
    is_eligible = len(groups_passed) > 0
    
    return {
        "is_eligible": is_eligible,
        "groups_passed": groups_passed,
        "criteria": criteria
    }

def rank_schemes(profile: dict, schemes_with_rules: List[tuple]) -> List[dict]:
    """
    schemes_with_rules: List of tuples (Scheme, list_of_rules)
    Returns list of dicts with {"scheme": Scheme, "eligibility": {...}}
    """
    results = []
    for scheme, rules in schemes_with_rules:
        eligibility = evaluate_scheme(profile, rules)
        
        # Calculate how many criteria passed overall for partial ranking
        passed_count = sum(1 for c in eligibility["criteria"] if c["passed"])
        total_count = len(eligibility["criteria"])
        
        score = 0
        if eligibility["is_eligible"]:
            score = 1000 + passed_count # Top tier
        elif total_count > 0:
            score = passed_count # Partial tier
        else:
            score = -1 # Unevaluable
            
        results.append({
            "scheme": scheme,
            "eligibility": eligibility,
            "_score": score,
            "matched_criteria_count": passed_count,
            "total_criteria_count": total_count
        })
        
    # Sort by score descending
    results.sort(key=lambda x: x["_score"], reverse=True)
    return results
