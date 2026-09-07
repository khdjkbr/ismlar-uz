"""Run a conservative machine quality pass over the editorial review queue."""
import json, re
from pathlib import Path

root = Path(__file__).resolve().parent
raw = (root / 'names_data.js').read_text(encoding='utf-8-sig')
rows = json.loads(raw.split('=', 1)[1].strip().rstrip(';'))
queue = json.loads((root / 'artifacts/editorial-review-queue.json').read_text(encoding='utf-8'))['items']
by_key = {(r['g'] + ':' + re.sub(r"[‘ʻ`’ʼ]", "'", r['l']).strip().lower()): r for r in rows}
results = []
for item in queue:
    row = by_key.get(item['key'], {})
    meaning = (row.get('m') or '').strip()
    origin = (row.get('lang') or '').strip()
    checks = {
        'meaning_present': bool(meaning) and meaning != 'Malumot kiritilmagan.',
        'origin_present': bool(origin),
        'meaning_length_ok': 8 <= len(meaning) <= 240,
        'has_sentence_punctuation': bool(re.search(r'[.!?]$', meaning)),
        'no_placeholder': not re.search(r'(ma.?lumot kiritilmagan|aniqlanmagan)', meaning, re.I),
        'no_repeated_word': not re.search(r'\b(\w+)\s+\1\b', meaning, re.I),
    }
    passed = all(checks.values())
    results.append({**item, 'checks': checks, 'machine_status': 'pass_for_editorial_review' if passed else 'needs_text_cleanup'})
summary = {
    'queue_size': len(results),
    'machine_pass': sum(r['machine_status'] == 'pass_for_editorial_review' for r in results),
    'needs_text_cleanup': sum(r['machine_status'] == 'needs_text_cleanup' for r in results),
    'source_verification_required': len(results),
    'note': 'Machine checks do not confirm etymology or sources; every item still needs editorial source verification.'
}
(root / 'artifacts/editorial-audit-1000.json').write_text(json.dumps({'summary': summary, 'items': results}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(summary, ensure_ascii=False))
