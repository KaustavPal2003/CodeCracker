# tracker/views/export_views.py
"""
Export stats to CSV or PDF.

Routes (add to urls.py):
  path('export/csv/<str:username>/',  export_csv_view,  name='export_csv'),
  path('export/pdf/<str:username>/',  export_pdf_view,  name='export_pdf'),

Dependencies:
  pip install reportlab   (PDF)
  csv is in stdlib        (CSV — zero extra deps)
"""
import csv
import io
from datetime import datetime
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, Http404
from django.shortcuts import get_object_or_404
from tracker.models import UserStats, UserProfile


def _get_stats_or_404(username):
    stats = UserStats.objects(username=username).first()
    if not stats:
        raise Http404("User stats not found.")
    return stats


def _history_rows(stats):
    """Return sorted rating history as list of dicts."""
    rows = []
    for h in stats.rating_history:
        rows.append({
            "platform":   h.platform or "",
            "contest":    h.contest  or "",
            "date":       h.date.strftime("%Y-%m-%d") if h.date else "",
            "rank":       h.rank       or 0,
            "old_rating": h.old_rating or 0,
            "new_rating": h.new_rating or 0,
            "change":     h.change     or 0,
        })
    rows.sort(key=lambda r: r["date"], reverse=True)
    return rows


# ─── CSV Export ───────────────────────────────────────────────────────────────

@login_required
def export_csv_view(request, username):
    """
    Only the owner (or admin) can export.
    Downloads a .csv with full contest history + summary header.
    """
    profile = UserProfile.get_or_create(request.user.username)
    if request.user.username != username and not profile.is_admin:
        return HttpResponse("Forbidden", status=403)

    stats = _get_stats_or_404(username)
    rows  = _history_rows(stats)

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = (
        f'attachment; filename="codecracker_{username}_'
        f'{datetime.utcnow().strftime("%Y%m%d")}.csv"'
    )

    writer = csv.writer(response)

    # Summary header block
    writer.writerow(["CodeCracker Stats Export"])
    writer.writerow(["Username",          username])
    writer.writerow(["Codeforces Rating", stats.codeforces_rating or "N/A"])
    writer.writerow(["LeetCode Solved",   stats.leetcode_solved   or 0])
    writer.writerow(["CodeChef Rating",   stats.codechef_rating   or "N/A"])
    writer.writerow(["AtCoder Rating",    getattr(stats, "atcoder_rating", None) or "N/A"])
    writer.writerow(["Exported At",       datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")])
    writer.writerow([])

    # Contest history
    writer.writerow(["Platform", "Contest", "Date", "Rank",
                     "Old Rating", "New Rating", "Change"])
    for r in rows:
        writer.writerow([r["platform"], r["contest"], r["date"],
                         r["rank"], r["old_rating"], r["new_rating"], r["change"]])

    return response


# ─── PDF Export ───────────────────────────────────────────────────────────────

@login_required
def export_pdf_view(request, username):
    """
    Generates a clean PDF report using ReportLab.
    Install: pip install reportlab
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (SimpleDocTemplate, Paragraph,
                                        Spacer, Table, TableStyle)
        from reportlab.lib.enums import TA_CENTER
    except ImportError:
        return HttpResponse(
            "PDF export requires ReportLab. "
            "Run: pip install reportlab",
            status=501, content_type="text/plain"
        )

    profile = UserProfile.get_or_create(request.user.username)
    if request.user.username != username and not profile.is_admin:
        return HttpResponse("Forbidden", status=403)

    stats = _get_stats_or_404(username)
    rows  = _history_rows(stats)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                             topMargin=2*cm, bottomMargin=2*cm,
                             leftMargin=2*cm, rightMargin=2*cm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"],
                                 fontSize=20, textColor=colors.HexColor("#1e1b4b"),
                                 spaceAfter=6, alignment=TA_CENTER)
    sub_style   = ParagraphStyle("sub", parent=styles["Normal"],
                                 fontSize=10, textColor=colors.HexColor("#64748b"),
                                 spaceAfter=4, alignment=TA_CENTER)
    heading_style = ParagraphStyle("heading", parent=styles["Heading2"],
                                   textColor=colors.HexColor("#6366f1"), spaceAfter=8)

    story = [
        Paragraph("CodeCracker Stats Report", title_style),
        Paragraph(
            f"Username: <b>{username}</b> &nbsp;·&nbsp; "
            f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
            sub_style
        ),
        Spacer(1, 0.5*cm),
    ]

    # Summary table
    atcoder_rat = getattr(stats, "atcoder_rating", None) or "N/A"
    summary_data = [
        ["Platform", "Stat", "Value"],
        ["Codeforces", "Rating",       str(stats.codeforces_rating or "N/A")],
        ["LeetCode",   "Problems Solved", str(stats.leetcode_solved or 0)],
        ["CodeChef",   "Rating",       str(stats.codechef_rating  or "N/A")],
        ["AtCoder",    "Rating",       str(atcoder_rat)],
    ]
    summary_tbl = Table(summary_data, colWidths=[5*cm, 5*cm, 5*cm])
    summary_tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,0), colors.HexColor("#1e1b4b")),
        ("TEXTCOLOR",    (0,0), (-1,0), colors.white),
        ("FONTNAME",     (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",     (0,0), (-1,-1), 10),
        ("ROWBACKGROUNDS", (0,1), (-1,-1),
         [colors.HexColor("#f8fafc"), colors.HexColor("#eef2ff")]),
        ("GRID",         (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ("PADDING",      (0,0), (-1,-1), 8),
        ("ALIGN",        (2,0), (2,-1), "CENTER"),
    ]))
    story += [Paragraph("Platform Summary", heading_style), summary_tbl, Spacer(1, 0.5*cm)]

    # Contest history table (max 100 rows for PDF size)
    if rows:
        story.append(Paragraph(
            f"Contest History (last {min(len(rows),100)} contests)", heading_style
        ))
        hist_data = [["Platform", "Contest", "Date", "Rank", "Rating", "Δ"]]
        for r in rows[:100]:
            change_str = (f"+{r['change']}" if r["change"] > 0
                          else str(r["change"]) if r["change"] < 0 else "—")
            hist_data.append([
                r["platform"],
                r["contest"][:45] + ("…" if len(r["contest"]) > 45 else ""),
                r["date"],
                str(r["rank"]) if r["rank"] else "—",
                str(r["new_rating"]),
                change_str,
            ])

        hist_tbl = Table(hist_data, colWidths=[2.5*cm, 7*cm, 2.5*cm, 1.5*cm, 2*cm, 1.5*cm])
        hist_tbl.setStyle(TableStyle([
            ("BACKGROUND",     (0,0), (-1,0), colors.HexColor("#6366f1")),
            ("TEXTCOLOR",      (0,0), (-1,0), colors.white),
            ("FONTNAME",       (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE",       (0,0), (-1,-1), 8),
            ("ROWBACKGROUNDS", (0,1), (-1,-1),
             [colors.white, colors.HexColor("#f1f5f9")]),
            ("GRID",           (0,0), (-1,-1), 0.3, colors.HexColor("#e2e8f0")),
            ("PADDING",        (0,0), (-1,-1), 5),
            ("ALIGN",          (3,0), (5,-1), "CENTER"),
        ]))
        story.append(hist_tbl)

    doc.build(story)
    pdf = buf.getvalue()

    response = HttpResponse(pdf, content_type="application/pdf")
    response["Content-Disposition"] = (
        f'attachment; filename="codecracker_{username}_'
        f'{datetime.utcnow().strftime("%Y%m%d")}.pdf"'
    )
    return response
