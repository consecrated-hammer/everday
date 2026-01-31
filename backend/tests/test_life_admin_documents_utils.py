from app.modules.integrations.gmail import service as gmail_service
from app.modules.life_admin import documents_service


def test_parse_hints_extracts_tags_folder_links():
    text = "folder: Taxes 2026 #invoice #tax link:123 link:456"
    hints = gmail_service.ParseHints(text)
    assert hints["folder"] == "Taxes 2026"
    assert set(hints["tags"]) == {"invoice", "tax"}
    assert hints["links"] == [123, 456]


def test_normalize_tag_slug():
    assert documents_service.NormalizeTagSlug("My Tag") == "my-tag"
    assert documents_service.NormalizeTagSlug("  ##") == "tag"
