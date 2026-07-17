"""
Jinja2 configuration for the server-rendered (web) layer.

This exists to let the original Django templates run almost unmodified on
FastAPI. It provides:
  - custom filters that mimic the Django template filters used in the
    templates (pluralize, floatformat, stringformat, date, default)
  - a `url_for(name, *args)` global that mimics Django's {% url %} tag,
    using the ROUTE_MAP below (kept in sync with web/*.py route paths)
  - a `widthratio(value, max_value, scale)` global for the one Django
    {% widthratio %} usage
  - a render() helper that always injects `request`, `user`, `active_nav`,
    and `messages` into the template context so templates don't need to
    guard against them being undefined.
"""
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi import Request

# ---------------------------------------------------------------------------
# Route map — mirrors the Django url names used throughout the templates.
# Keep this in sync with the paths registered in web/*.py.
# ---------------------------------------------------------------------------
ROUTE_MAP = {
    "dashboard": "/dashboard/",
    "agent": "/agent/",
    "login": "/login/",
    "logout": "/logout/",

    "item_list": "/items/",
    "item_create": "/items/create/",
    "item_detail": "/items/{}/",
    "item_edit": "/items/{}/edit/",
    "item_delete": "/items/{}/delete/",

    "batch_add": "/items/{}/batches/add/",
    "batch_edit": "/batches/{}/edit/",
    "batch_delete": "/batches/{}/delete/",

    "withdraw_item": "/withdrawals/take/",
    "withdrawal_log": "/withdrawals/log/",

    "category_list": "/categories/",
    "category_delete": "/categories/{}/delete/",
    "room_list": "/rooms/",
    "room_delete": "/rooms/{}/delete/",

    "plan_list": "/restock/",
    "plan_create": "/restock/create/",
    "plan_detail": "/restock/{}/",
    "plan_delete": "/restock/{}/delete/",
    "plan_print": "/restock/{}/print/",
    "plan_update_status": "/restock/{}/status/",
    "plan_item_edit": "/restock/items/{}/edit/",
    "plan_item_delete": "/restock/items/{}/delete/",
    "mark_restocked": "/restock/items/{}/mark-restocked/",

    "report_home": "/reports/",

    "user_list": "/users/",
    "user_create": "/users/create/",
    "user_edit": "/users/{}/edit/",
    "user_delete": "/users/{}/delete/",
}


def url_for_name(name: str, *args) -> str:
    try:
        path = ROUTE_MAP[name]
    except KeyError:
        raise KeyError(f"No web route registered for url_for('{name}') — check ROUTE_MAP in web/templating.py")
    if args:
        return path.format(*[getattr(a, "id", a) for a in args])
    return path


# ---------------------------------------------------------------------------
# Django-style filters
# ---------------------------------------------------------------------------

def dj_pluralize(value, suffix="s"):
    try:
        n = float(value)
    except (TypeError, ValueError):
        n = 0
    return "" if n == 1 else suffix


def dj_floatformat(value, decimals=0):
    try:
        v = float(value)
    except (TypeError, ValueError):
        return value
    if decimals == 0:
        return f"{v:,.0f}"
    return f"{v:,.{decimals}f}"


def dj_stringformat(value, fmt="s"):
    return str(value)


_DJANGO_TO_STRFTIME = {
    "Y": "%Y", "y": "%y", "m": "%m", "d": "%d",
    "M": "%b", "N": "%b", "F": "%B",
    "g": "%-I", "G": "%-H", "h": "%I", "H": "%H",
    "i": "%M", "s": "%S", "A": "%p",
}


def dj_date(value, fmt="d M Y"):
    if not value:
        return ""
    if isinstance(value, str):
        return value
    strftime_fmt = "".join(_DJANGO_TO_STRFTIME.get(c, c) for c in fmt)
    try:
        return value.strftime(strftime_fmt)
    except Exception:
        return str(value)


def dj_default(value, arg=""):
    """Mirrors Django's |default: falls back on any falsy value (None, '', 0, False)."""
    if value in (None, "", False):
        return arg
    if isinstance(value, (int, float)) and value == 0:
        return arg
    return value


def dj_widthratio(value, max_value, scale=100):
    try:
        v = float(value or 0)
        mx = float(max_value or 0)
    except (TypeError, ValueError):
        return 0
    if not mx:
        return 0
    return round((v / mx) * scale)


def restocked_count(items):
    """Counts RestockPlanItem entries with is_restocked=True. Used by
    plan_list.html's progress bar (replaces a broken Django ORM expression
    in the original template)."""
    return sum(1 for i in items if getattr(i, "is_restocked", False))


templates = Jinja2Templates(directory="templates")
templates.env.globals["url_for"] = url_for_name
templates.env.globals["widthratio"] = dj_widthratio
templates.env.globals["restocked_count"] = restocked_count
templates.env.filters["pluralize"] = dj_pluralize
templates.env.filters["floatformat"] = dj_floatformat
templates.env.filters["stringformat"] = dj_stringformat
templates.env.filters["djdate"] = dj_date
templates.env.filters["djdefault"] = dj_default


def render(request: Request, template_name: str, context: dict = None, user=None,
           active_nav: str = "", status_code: int = 200) -> HTMLResponse:
    """Common render helper: always injects request/user/active_nav/messages
    so templates never hit an UndefinedError on those."""
    ctx = {
        "request": request,
        "user": user,
        "active_nav": active_nav,
        "messages": [],
    }
    if context:
        ctx.update(context)
    return templates.TemplateResponse(template_name, ctx, status_code=status_code)
