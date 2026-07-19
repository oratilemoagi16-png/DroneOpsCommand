import logging

import httpx

from app.config import settings
from app.services.ollama import SYSTEM_PROMPT_TEMPLATE

logger = logging.getLogger("doc.gemini_llm")

# httpx logs the full request URL at INFO, which would expose the API key.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


async def generate_report(
    user_narrative: str,
    mission_title: str,
    mission_type: str,
    location: str,
    flight_summaries: list[dict],
    ground_covered_acres: float | None = None,
    total_duration_seconds: float = 0,
    total_distance_meters: float = 0,
    mission_date: str | None = None,
    company_name: str = "DroneOps",
    api_key: str = "",
    model: str | None = None,
) -> str:
    """Generate a report narrative using the Google Gemini API."""

    resolved_key = api_key or settings.gemini_api_key
    if not resolved_key:
        raise ValueError("No Gemini API key configured — set it in Settings > AI / Report Generation")

    # Build per-flight details (same format as ollama.py and claude_llm.py)
    flight_details = ""
    for i, flight in enumerate(flight_summaries, 1):
        flight_details += f"\nFlight {i}:\n"
        flight_details += f"  Aircraft: {flight.get('aircraft', 'Unknown')}\n"
        flight_details += f"  Max Altitude: {flight.get('max_altitude', 'Unknown')}\n"
        if flight.get('notes'):
            flight_details += f"  Notes: {flight['notes']}\n"

    # Build mission-level totals
    totals = f"Number of Flights: {len(flight_summaries)}"
    if total_duration_seconds > 0:
        minutes = total_duration_seconds / 60
        totals += f"\nTotal Flight Time: {minutes:.0f} minutes"
    if total_distance_meters > 0:
        miles = total_distance_meters / 1609.344
        totals += f"\nTotal Distance Covered: {miles:.2f} miles"
    if ground_covered_acres:
        totals += f"\nEstimated Area Covered: {ground_covered_acres:.2f} acres"

    user_prompt = f"""Mission: {mission_title}
Date: {mission_date or 'Not specified'}
Type: {mission_type}
Location: {location}

Mission Totals:
{totals}

Flight Data:
{flight_details}

Operator Notes (CONTEXT ONLY — translate into third-person factual narrative; \
do NOT address the operator or offer them advice):
{user_narrative}

Generate the client-facing after-action report. The reader is the client, not the \
pilot. Use third person throughout. Do not include pilot coaching."""

    resolved_model = model or settings.gemini_model
    logger.info("Gemini report generation starting for '%s' (%s) model=%s", mission_title, location, resolved_model)

    system_text = SYSTEM_PROMPT_TEMPLATE.format(company_name=company_name)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{resolved_model}:generateContent"
    payload = {
        "systemInstruction": {"parts": [{"text": system_text}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            # ADR-0030 — output cap. A full after-action report runs ~1.5–2.5k tokens;
            # 4096 leaves clear headroom. Gemini's context window is large enough
            # that the input side is not the constraint here.
            "maxOutputTokens": 4096,
            "temperature": 0.3,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(url, params={"key": resolved_key}, json=payload)
            logger.info("Gemini response: %d in %.1fs", resp.status_code, resp.elapsed.total_seconds())
            resp.raise_for_status()
            data = resp.json()

        candidates = data.get("candidates") or []
        if not candidates:
            raise ValueError("Gemini response contained no candidates")

        candidate = candidates[0]
        if candidate.get("finishReason") not in (None, "STOP"):
            logger.warning("Gemini finishReason=%s", candidate.get("finishReason"))

        parts = candidate.get("content", {}).get("parts") or []
        response_text = "".join(p.get("text", "") for p in parts)
        if not response_text:
            raise ValueError("Gemini response contained no text")

        logger.info("Gemini report generated: %d chars", len(response_text))
        return response_text
    except httpx.TimeoutException:
        logger.error("Gemini request timed out after 300s for '%s'", mission_title)
        raise
    except httpx.HTTPStatusError as exc:
        # Never log the full request URL — the API key is in the query string.
        logger.error("Gemini HTTP error %s: %s", exc.response.status_code, exc.response.text[:500])
        raise RuntimeError(f"Gemini request failed with status {exc.response.status_code}") from exc
    except Exception as exc:
        logger.error("Gemini request failed: %s", exc, exc_info=True)
        raise
