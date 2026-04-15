"""ELO rating system."""

K_FACTOR = 32


def expected_score(rating_a: float, rating_b: float) -> float:
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))


def calculate_new_ratings(
    white_rating: float,
    black_rating: float,
    result: str,  # "white" | "black" | "draw"
) -> tuple[int, int]:
    """Return (delta_white, delta_black). Draw always returns (0, 0)."""
    if result == "draw":
        return 0, 0

    exp_white = expected_score(white_rating, black_rating)
    exp_black = 1 - exp_white

    if result == "white":
        score_white, score_black = 1.0, 0.0
    else:
        score_white, score_black = 0.0, 1.0

    delta_white = round(K_FACTOR * (score_white - exp_white))
    delta_black = round(K_FACTOR * (score_black - exp_black))
    return delta_white, delta_black
