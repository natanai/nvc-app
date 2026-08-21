from pathlib import Path
import re


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


# Move post-generation copy corrections into the page compiler.
pages_path = Path('scripts/build-pages.mjs')
pages = pages_path.read_text(encoding='utf-8')
pages = replace_exact(
    pages,
    "    submitLabel: '💾 Save to device',",
    "    submitLabel: 'Save to device',",
    'strategy submit label',
)
pages = replace_exact(
    pages,
    '''                  <h2 id="journal-form-heading" class="section-title">Log a new entry</h2>\n                  <p class="journal-form-section__hint">Tag what's present right now. Unsure of the feeling? Leave it blank and lean on the notes.</p>''',
    '''                  <h2 id="journal-form-heading" class="section-title">New entry</h2>\n                  <p class="journal-form-section__hint">Tag what’s present now. Feeling optional—notes are enough.</p>''',
    'journal copy',
)
pages = replace_exact(
    pages,
    '''function buildPersonalStrategyNotice(basePath, suffix = '') {\n  const safeSuffix = suffix ? ` ${suffix}` : '';\n  return `<p class="strategy-form__notice">Personal strategies you add stay on this browser. Visit the <a href="${basePath}inventory/">inventory screen</a> to export them if you would like a backup.${safeSuffix}</p>`;\n}''',
    '''function buildPersonalStrategyNotice() {\n  return '<p class="strategy-form__notice">Backup, restore, and account sync are in Menu → Account &amp; data.</p>';\n}''',
    'strategy notice',
)
pages_path.write_text(pages, encoding='utf-8')

# The safe publisher should no longer need a post-generation HTML repair pass.
safe_path = Path('scripts/build-pages-safe.mjs')
safe = safe_path.read_text(encoding='utf-8')
safe = replace_exact(
    safe,
    "  runNode(stageRoot, 'scripts/finalize-static-assets.mjs');\n",
    '',
    'safe-builder finalizer call',
)
safe_path.write_text(safe, encoding='utf-8')

# Push Poems must use the ownership-safe page entry point rather than invoking
# the destructive historical generator + finalizer directly.
poems_path = Path('.github/workflows/push-poems.yml')
poems = poems_path.read_text(encoding='utf-8')
poems = replace_exact(
    poems,
    '''      - name: Rebuild feelings pages\n        if: ${{ inputs.run_build_pages != 'false' }}\n        run: |\n          node scripts/build-pages.mjs --scope=feelings,faux-feelings\n          node scripts/finalize-static-assets.mjs\n''',
    '''      - name: Rebuild feelings pages\n        if: ${{ inputs.run_build_pages != 'false' }}\n        run: npm run build:pages -- --scope feelings,faux-feelings\n''',
    'Push Poems page build',
)
poems = replace_exact(
    poems,
    '''          git add -A\n          git commit -m "Update poems from poems_formatted.txt"\n''',
    '''          unexpected="$(git diff --name-only | grep -Ev '^(data/(index|body-regions)\\.json|feelings/|faux-feelings/)' || true)"\n          if [ -n "$unexpected" ]; then\n            echo "Unexpected files changed by Push Poems:" >&2\n            printf '%s\\n' "$unexpected" >&2\n            exit 1\n          fi\n          git add data/index.json data/body-regions.json feelings faux-feelings\n          git diff --cached --check\n          git commit -m "Update poems from poems_formatted.txt"\n''',
    'Push Poems staging',
)
poems_path.write_text(poems, encoding='utf-8')

# Rewrite regression expectations around direct template ownership.
test_path = Path('tests/shared-density-polish.test.mjs')
tests = test_path.read_text(encoding='utf-8')
first_pattern = re.compile(
    r"test\('build pipeline writes final user-facing static markup before deployment', async \(\) => \{[\s\S]*?\n\}\);\n\n(?=test\('checked-in static artifacts already contain the final UI')"
)
first_replacement = '''test('page compiler emits final user-facing markup without a post-generation UI repair pass', async () => {\n  const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));\n  const safeBuilder = await fs.readFile(path.join(root, 'scripts/build-pages-safe.mjs'), 'utf8');\n  const buildPages = await fs.readFile(path.join(root, 'scripts/build-pages.mjs'), 'utf8');\n\n  assert.equal(packageJson.scripts['build:pages'], 'node scripts/build-pages-safe.mjs');\n  assert.ok(safeBuilder.includes("runNode(stageRoot, 'scripts/build-pages.mjs'"));\n  assert.ok(!safeBuilder.includes('finalize-static-assets.mjs'));\n  await assert.rejects(fs.access(path.join(root, 'scripts/finalize-static-assets.mjs')), { code: 'ENOENT' });\n\n  assert.ok(buildPages.includes("submitLabel: 'Save to device'"));\n  assert.ok(!buildPages.includes('💾 Save to device'));\n  assert.ok(buildPages.includes('<h2 id="journal-form-heading" class="section-title">New entry</h2>'));\n  assert.ok(buildPages.includes('Tag what’s present now. Feeling optional—notes are enough.'));\n  assert.ok(buildPages.includes('Backup, restore, and account sync are in Menu → Account &amp; data.'));\n  assert.ok(!buildPages.includes('Personal strategies you add stay on this browser.'));\n});\n\n'''
tests, count = first_pattern.subn(first_replacement, tests, count=1)
if count != 1:
    raise SystemExit(f'canonical page-output test replacement count: {count}')

feed_pattern = re.compile(
    r"test\('shared strategies behavior is feed-first without repairing static chrome in JS', async \(\) => \{[\s\S]*?\n\}\);\n\n(?=test\('desktop Inventory keeps the Needs header left-aligned)"
)
feed_replacement = '''test('shared strategies static chrome is already final and runtime stays behavior-only', async () => {\n  const feed = await fs.readFile(path.join(root, 'scripts/strategy-feed.js'), 'utf8');\n  const feedHtml = await fs.readFile(path.join(root, 'feed/index.html'), 'utf8');\n\n  assert.ok(feed.includes("addButton.textContent = 'Save to inventory'"));\n  assert.ok(feed.includes('await fetchAndRenderFeed();'));\n  assert.ok(feed.includes("state.scopeSelect?.addEventListener('change'"));\n  assert.ok(feed.includes("state.sortSelect?.addEventListener('change', fetchAndRenderFeed)"));\n  assert.ok(!feed.includes('[data-feed-follows-check]'));\n  assert.ok(!feed.includes('[data-feed-fetch]'));\n  assert.ok(feedHtml.includes('<h1 class="page-title">Shared strategies</h1>'));\n  assert.ok(!feedHtml.includes('data-feed-follows-check'));\n  assert.ok(!feedHtml.includes('data-feed-fetch'));\n});\n\n'''
tests, count = feed_pattern.subn(feed_replacement, tests, count=1)
if count != 1:
    raise SystemExit(f'feed static-ownership test replacement count: {count}')

test_path.write_text(tests, encoding='utf-8')

# The finalizer is now intentionally obsolete; Feed is hand-owned and generated
# routes emit their final copy directly.
finalizer_path = Path('scripts/finalize-static-assets.mjs')
if not finalizer_path.exists():
    raise SystemExit('finalize-static-assets.mjs is already missing')
finalizer_path.unlink()

print('Canonicalized static output ownership and removed the HTML finalizer.')
