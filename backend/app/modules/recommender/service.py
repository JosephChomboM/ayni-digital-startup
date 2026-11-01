from collections.abc import Sequence

from app.modules.recommender.schemas import MemoryCandidate, SessionFeedback

__all__ = ["MemoryCandidate", "SessionFeedback", "rank_memories"]

# Initial product heuristic, not a trained or clinically validated prediction.
MIN_FEEDBACK = 3
REACTION_WEIGHTS = {"receptivo": 1.0, "emocionado": 1.0, "indiferente": 0.0, "agitado": -1.0}


def rank_memories(
    memories: Sequence[MemoryCandidate],
    feedback: Sequence[SessionFeedback],
    *,
    enabled: bool = True,
) -> list[MemoryCandidate]:
    """Rank one authorized elder's content; keep the safe input order on failure.

    The caller supplies unique memories and one feedback record per session.
    This function does not fetch data, authorize access, or evaluate pause alerts.
    Ineligible memories are excluded even when ranking is disabled or fails.
    """
    eligible = [memory for memory in memories if memory.is_positive and not memory.is_sensitive]
    if not enabled or len(eligible) < 2:
        return eligible

    positions = {memory.memory_id: index for index, memory in enumerate(eligible)}
    history: list[tuple[list[int], float]] = []
    for entry in feedback:
        indices = [positions[key] for key in dict.fromkeys(entry.memory_ids) if key in positions]
        weight = REACTION_WEIGHTS[entry.reaction]
        if indices and weight:
            history.append((indices, weight))
    if len(history) < MIN_FEEDBACK:
        return eligible

    try:
        scores = _score_memories(eligible, history)
        # Python's stable sort preserves the original order for equal scores.
        return [eligible[index] for index in sorted(range(len(eligible)), key=lambda i: -scores[i])]
    except Exception:
        # Optional ranking must not prevent a session. Do not log family data.
        return eligible


def _score_memories(
    memories: Sequence[MemoryCandidate],
    history: list[tuple[list[int], float]],
) -> list[float]:
    # Lazy imports let sessions work even if the optional calculation is unavailable.
    import numpy as np
    from sklearn.feature_extraction import DictVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    features: list[dict[str, float]] = []
    for memory in memories:
        row = {f"kind:{memory.kind}": 1.0}
        for tag in memory.tags:
            if normalized := tag.strip().casefold():
                row[f"tag:{normalized}"] = 1.0
        features.append(row)

    matrix = DictVectorizer().fit_transform(features)
    scores = np.zeros(len(memories))
    for indices, weight in history:
        # Share the session's signal across its known eligible items. A session
        # with more items must not count as more feedback observations.
        scores += weight * cosine_similarity(matrix, matrix[indices]).mean(axis=1)
    scores /= len(history)
    if not np.isfinite(scores).all():
        raise ValueError("Non-finite ranking scores")
    return scores.tolist()
