from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

doc = SimpleDocTemplate(
    "Property_Media_Cost_Comparison_Updated.pdf",
    pagesize=A4,
    topMargin=30*mm,
    bottomMargin=20*mm,
    leftMargin=25*mm,
    rightMargin=25*mm,
)

styles = getSampleStyleSheet()
title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=22, spaceAfter=20)
heading_style = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=14, spaceBefore=20, spaceAfter=10)

header_bg = colors.Color(0.85, 0.85, 0.85)

def make_table(data, col_widths=None):
    t = Table(data, colWidths=col_widths)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]
    t.setStyle(TableStyle(style))
    return t

elements = []

# Title
elements.append(Paragraph("Property Media Cost Comparison", title_style))

# 1. Annual Property Volume
elements.append(Paragraph("1. Annual Property Volume", heading_style))
elements.append(make_table([
    ["Content Type", "Volume"],
    ["Unpresented Video (UPTC)", "70"],
    ["Presented Video (PTC)", "107"],
    ["Unpresented Social Content", "16"],
    ["Presented Social Content", "83"],
    ["Informative Content", "21"],
    ["Total Properties", "297"],
], col_widths=[250, 80]))

# 2. Current Cost Structure
elements.append(Paragraph("2. Current Cost Structure", heading_style))
elements.append(make_table([
    ["Cost Category", "Annual Cost"],
    ["Videography (Total Employment Cost)", "£49,000"],
    ["Photography & Floorplans", "£84,000"],
    ["Total Current Cost", "£133,000"],
], col_widths=[250, 120]))

# 3. Proposed Cost Structure
elements.append(Paragraph("3. Proposed Cost Structure", heading_style))
elements.append(make_table([
    ["Content Type", "Volume", "Rate per Property", "Total Cost"],
    ["Unpresented Video", "70", "£200", "£14,000"],
    ["Presented Video", "107", "£275", "£29,425"],
    ["Unpresented Social Content", "16", "£200", "£3,200"],
    ["Presented Social Content", "83", "£225", "£18,675"],
    ["Informative Content", "21", "£125", "£2,625"],
    ["Total", "297", "-", "£66,565"],
], col_widths=[170, 60, 120, 90]))

# 4. Cost Comparison Summary
elements.append(Paragraph("4. Cost Comparison Summary", heading_style))
elements.append(make_table([
    ["", "Current Model", "Proposed Model"],
    ["Total Annual Cost", "£133,000", "£66,565"],
    ["Annual Cost Difference", "-", "£66,435 Saving"],
    ["Number of Suppliers", "Multiple", "Single Provider"],
    ["Booking & Scheduling", "Fragmented", "Centralised"],
    ["Administrative Involvement", "High", "Reduced"],
    ["Client Experience", "Variable", "Consistent"],
], col_widths=[170, 110, 120]))

# Footer paragraph
elements.append(Spacer(1, 20))
elements.append(Paragraph(
    "The proposed model consolidates photography, videography, and floorplans into a single, "
    "streamlined service. This approach reduces overall annual costs while simplifying scheduling, "
    "lowering administrative workload, and improving consistency across all property media.",
    styles["Normal"]
))

doc.build(elements)
print("PDF generated successfully.")
