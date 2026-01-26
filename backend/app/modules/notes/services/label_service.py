import json
from typing import List


def GetScope(labels: List[str]) -> str:
    """Extract scope from labels. Returns 'personal', 'family', or 'shared'."""
    if not labels:
        return "personal"
    
    for label in labels:
        if label == "everday:family":
            return "family"
        if label == "everday:shared":
            return "shared"
    
    return "personal"


def SetScope(labels: List[str], scope: str) -> List[str]:
    """Set scope in labels, removing any existing scope label."""
    # Remove existing scope labels
    filtered = [l for l in labels if l not in ["everday:family", "everday:shared"]]
    
    # Add new scope if not personal
    if scope == "family":
        filtered.append("everday:family")
    elif scope == "shared":
        filtered.append("everday:shared")
    
    return filtered


def HasOwnerLabel(labels: List[str], user_id: int) -> bool:
    """Check if user ownership label exists."""
    target = f"everday:user:{user_id}"
    return target in labels


def AddOwnerLabel(labels: List[str], user_id: int) -> List[str]:
    """Add user ownership label if not present."""
    target = f"everday:user:{user_id}"
    if target not in labels:
        labels.append(target)
    return labels


def ParseLabels(labels_json: str) -> List[str]:
    """Parse JSON labels string to list."""
    if not labels_json:
        return []
    try:
        parsed = json.loads(labels_json)
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def SerializeLabels(labels: List[str]) -> str:
    """Serialize labels list to JSON string."""
    return json.dumps(labels) if labels else json.dumps([])
