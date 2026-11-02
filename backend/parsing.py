"""Parsing helpers for VAPI tool calls and REST payloads: dates, times, names and call IDs."""

import datetime as dt
import json
import re
from typing import Any, Optional, Tuple

from fastapi import Request

from database.database import get_pakistan_now, PKT


def _parse_time_value(time_str: str) -> Optional[dt.time]:
    """Parse time string in multiple common formats."""
    if not time_str or not isinstance(time_str, str):
        return None
    time_str = time_str.strip().upper()
    for fmt in ["%I:%M %p", "%I:%M%p", "%I %p", "%I%p", "%H:%M:%S", "%H:%M"]:
        try:
            return dt.datetime.strptime(time_str, fmt).time()
        except ValueError:
            pass
    return None


def _parse_date_value(val: Any) -> Optional[dt.date]:
    """Safely parse date from date object, datetime object, or natural string (e.g. '2 November', 'November 2', '2026-11-02')."""
    if not val:
        return None
    if isinstance(val, dt.datetime):
        return val.date()
    if isinstance(val, dt.date):
        return val
    if isinstance(val, str):
        val = val.strip()
        # Clean ordinal suffixes: 1st, 2nd, 3rd, 4th
        clean_val = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', val, flags=re.IGNORECASE).strip()

        # Handle ISO timestamp format (e.g. 2026-11-02T15:00:00)
        if "T" in clean_val:
            clean_val = clean_val.split("T")[0]

        # Try standard ISO
        try:
            return dt.date.fromisoformat(clean_val)
        except Exception:
            pass

        now_year = get_pakistan_now().year
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%m/%d/%Y",
            "%d/%m/%Y",
            "%d %B %Y",
            "%B %d, %Y",
            "%B %d %Y",
            "%d %b %Y",
            "%b %d, %Y",
            "%b %d %Y",
            "%d %B",
            "%B %d",
            "%d %b",
            "%b %d",
        ]
        for fmt in formats:
            try:
                parsed = dt.datetime.strptime(clean_val, fmt).date()
                if "%Y" not in fmt and "%y" not in fmt:
                    parsed = parsed.replace(year=now_year)
                return parsed
            except ValueError:
                pass

        if " " in clean_val:
            date_part = clean_val.split(" ")[0]
            try:
                return dt.date.fromisoformat(date_part)
            except Exception:
                pass

    return None


def _parse_datetime_value(val: Any, time_val: Any = None) -> Optional[dt.datetime]:
    """Parse datetime from ISO strings, combined date+time, or naive datetime, converted to PKT."""
    if not val:
        return None
    if isinstance(val, dt.datetime):
        if val.tzinfo:
            return val.astimezone(PKT).replace(tzinfo=None)
        return val
    if isinstance(val, dt.date):
        if time_val:
            parsed_time = _parse_time_value(str(time_val))
            if parsed_time:
                return dt.datetime.combine(val, parsed_time)
        return dt.datetime.combine(val, dt.time(12, 0))

    if isinstance(val, str):
        val = val.strip()
        clean_val = val
        # The AI receptionist operates exclusively in Pakistan Standard Time (PKT).
        # Models often append 'Z' by convention, which would falsely offset PKT by +5h if treated as UTC.
        # Simply strip 'Z' / 'z' so the patient's requested hour remains in local Pakistan Time.
        if clean_val.endswith("Z") or clean_val.endswith("z"):
            clean_val = clean_val[:-1]

        for fmt in [
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
        ]:
            try:
                parsed = dt.datetime.strptime(clean_val, fmt)
                if fmt == "%Y-%m-%d" and time_val:
                    parsed_time = _parse_time_value(str(time_val))
                    if parsed_time:
                        return dt.datetime.combine(parsed.date(), parsed_time)
                return parsed
            except ValueError:
                pass

        try:
            parsed = dt.datetime.fromisoformat(clean_val)
            return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        except Exception:
            pass

        # Try parsing natural date with optional time
        p_date = _parse_date_value(clean_val)
        if p_date:
            p_time = _parse_time_value(str(time_val)) if time_val else dt.time(12, 0)
            return dt.datetime.combine(p_date, p_time or dt.time(12, 0))

    return None


async def _extract_call_id(request: Request) -> Optional[str]:
    """Extract the VAPI call ID (body["message"]["call"]["id"]) so a booking can be linked to its call transcript."""
    try:
        body = await request.json()  # Starlette caches the parsed body, so this does not re-read the stream
    except Exception:
        return None
    if not isinstance(body, dict):
        return None
    for container in (body.get("message"), body):
        if isinstance(container, dict) and isinstance(container.get("call"), dict):
            call_id = container["call"].get("id")
            if call_id:
                return str(call_id)
    return None


async def _extract_tool_payload(request: Request) -> Tuple[dict, Optional[str], Optional[str]]:
    """Extract tool arguments, tool_call_id, and function name from incoming request.

    Supports:
    - VAPI webhook payload: body["message"]["toolCalls"] / toolCallList / toolWithToolCallList
    - VAPI direct toolCall: body["toolCall"] or body["toolCalls"]
    - Standard REST payload: body
    """
    try:
        body = await request.json()
    except Exception:
        body = {}
    print(f"[VAPI RAW INCOMING] URL={request.url.path}, body={body}")

    tool_call_id = None
    func_name = None
    args = {}

    if isinstance(body, dict):
        tool_calls = None
        if "message" in body and isinstance(body["message"], dict):
            msg = body["message"]
            tool_calls = (
                msg.get("toolCalls")
                or msg.get("toolCallList")
                or msg.get("toolWithToolCallList")
                or msg.get("tools")
            )
        elif "toolCalls" in body and isinstance(body["toolCalls"], list):
            tool_calls = body["toolCalls"]
        elif "toolCallList" in body and isinstance(body["toolCallList"], list):
            tool_calls = body["toolCallList"]
        elif "toolCall" in body and isinstance(body["toolCall"], dict):
            tool_calls = [body["toolCall"]]

        if tool_calls and isinstance(tool_calls, list) and len(tool_calls) > 0:
            first_tool = tool_calls[0]
            tool_call_id = first_tool.get("id") or first_tool.get("toolCallId")
            fn = first_tool.get("function") or first_tool
            func_name = fn.get("name") if isinstance(fn, dict) else None
            raw_args = (
                (fn.get("arguments") or fn.get("parameters"))
                if isinstance(fn, dict)
                else {}
            )
            if isinstance(raw_args, str):
                try:
                    args = json.loads(raw_args)
                except Exception:
                    args = {}
            elif isinstance(raw_args, dict):
                args = raw_args
        else:
            args = body

    # Unnest / unwrap nested parameter dicts if present
    if isinstance(args, dict):
        unwrapped = dict(args)
        for nested_key in ["parameters", "arguments", "input", "body", "properties"]:
            if nested_key in unwrapped and isinstance(unwrapped[nested_key], dict):
                unwrapped.update(unwrapped[nested_key])
        args = unwrapped

    return args, tool_call_id, func_name


def _extract_patient_name(args: dict) -> Optional[str]:
    """Extract patient name reliably across multiple naming conventions and nested payloads."""
    if not isinstance(args, dict):
        return None

    # Priority direct keys
    priority_keys = [
        "patient_name", "patientName", "patient_full_name", "patientFullName",
        "full_name", "fullName", "name", "patient", "caller_name", "callerName",
        "user_name", "userName", "customer_name", "customerName", "client_name", "clientName"
    ]
    for k in priority_keys:
        val = args.get(k)
        if val and isinstance(val, str) and val.strip():
            cleaned = val.strip()
            if cleaned.lower() not in ["none", "null", "undefined", "unknown", "n/a", "caller", "user"]:
                return cleaned

    # Case-insensitive / fuzzy key search across dict
    for k, val in args.items():
        if isinstance(k, str) and isinstance(val, str) and val.strip():
            k_lower = k.lower().replace("-", "_").replace(" ", "_")
            if any(term in k_lower for term in ["name", "patient", "caller", "client", "customer"]):
                cleaned = val.strip()
                if cleaned.lower() not in ["none", "null", "undefined", "unknown", "n/a", "caller", "user", "general consultation"]:
                    return cleaned

    # Search nested dictionaries
    for v in args.values():
        if isinstance(v, dict):
            nested = _extract_patient_name(v)
            if nested:
                return nested

    return None


def _extract_datetime_and_time(args: dict) -> Tuple[Optional[dt.datetime], Optional[str]]:
    """Extract appointment datetime and time string across multiple conventions."""
    if not isinstance(args, dict):
        return None, None

    dt_keys = [
        "start_time", "startTime", "appointment_datetime", "appointment_time_and_date",
        "datetime", "dateTime", "date_time", "start", "appointment_time", "slot"
    ]
    date_keys = ["date", "appointment_date", "day", "target_date"]
    time_keys = ["time", "appointment_time", "slot", "preferred_time", "time_slot"]

    raw_dt = None
    for k in dt_keys:
        if args.get(k):
            raw_dt = args.get(k)
            break

    raw_date = None
    for k in date_keys:
        if args.get(k):
            raw_date = args.get(k)
            break

    raw_time = None
    for k in time_keys:
        if args.get(k):
            raw_time = args.get(k)
            break

    # If raw_date or raw_dt is a phrase like "today" or "tomorrow"
    now_pkt = get_pakistan_now()
    if isinstance(raw_date, str):
        lowered = raw_date.lower().strip()
        if "today" in lowered:
            raw_date = now_pkt.date().isoformat()
        elif "tomorrow" in lowered:
            raw_date = (now_pkt.date() + dt.timedelta(days=1)).isoformat()

    if isinstance(raw_dt, str):
        lowered = raw_dt.lower().strip()
        if "today" in lowered:
            raw_dt = raw_dt.replace("today", now_pkt.date().isoformat()).replace("Today", now_pkt.date().isoformat())
        elif "tomorrow" in lowered:
            raw_dt = raw_dt.replace("tomorrow", (now_pkt.date() + dt.timedelta(days=1)).isoformat()).replace("Tomorrow", (now_pkt.date() + dt.timedelta(days=1)).isoformat())

    parsed_dt = _parse_datetime_value(raw_dt or raw_date, time_val=raw_time)
    if parsed_dt:
        return parsed_dt, raw_time

    # Deep scan all values in args
    for v in args.values():
        if isinstance(v, str):
            p = _parse_datetime_value(v, time_val=raw_time)
            if p:
                return p, raw_time
            d = _parse_date_value(v)
            if d:
                return _parse_datetime_value(d, time_val=raw_time), raw_time

    return None, raw_time
