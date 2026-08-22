from pathlib import Path
import re

ROOT = Path('.')


def replace_once(path: str, old: str, new: str) -> None:
    file_path = ROOT / path
    text = file_path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one anchor, found {count}: {old[:80]!r}')
    file_path.write_text(text.replace(old, new, 1), encoding='utf-8')


def replace_css_block(text: str, selector: str, body: str) -> str:
    marker = f'{selector} {{'
    start = text.find(marker)
    if start < 0:
        raise SystemExit(f'styles.css: missing selector {selector!r}')
    brace = text.find('{', start)
    depth = 0
    end = None
    for index in range(brace, len(text)):
        char = text[index]
        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                end = index + 1
                break
    if end is None:
        raise SystemExit(f'styles.css: unterminated selector {selector!r}')
    return text[:start] + f'{selector} {{\n{body}\n}}' + text[end:]


# Journal copy and state ownership: keep help concise and do not render an empty
# confirmation panel before there is anything to confirm.
replace_once(
    'assets/js/journal/module.js',
    """  hints: {\n    emotion: 'Use any word that fits. Unsure? Leave it blank for now.',\n    intensity: 'Slide to note how strong the feeling is.',\n    needs: 'Pick one or more needs that connect. Selected needs appear below so you can double-check them. Leave blank if you are not sure yet.',\n    tags: 'Separate tags with commas so you can filter later.',\n    notes: '',\n  },""",
    """  hints: {\n    emotion: 'Use any word that fits. Leave blank if unsure.',\n    intensity: 'How strong is it right now?',\n    needs: 'Choose any needs that connect. Leave blank if unsure.',\n    tags: 'Separate tags with commas.',\n    notes: '',\n  },""",
)
replace_once(
    'assets/js/journal/module.js',
    """    attrs: {\n      'data-journal-needs-summary': '',\n      'aria-live': 'polite',\n    },""",
    """    attrs: {\n      'data-journal-needs-summary': '',\n      'aria-live': 'polite',\n      hidden: true,\n    },""",
)
replace_once(
    'assets/js/journal/module.js',
    """    const hasSelection = labels.length > 0;\n    if (this.needsSummaryEmpty) {""",
    """    const hasSelection = labels.length > 0;\n    if (this.needsSummaryEl) {\n      this.needsSummaryEl.hidden = !hasSelection;\n    }\n    if (this.needsSummaryEmpty) {""",
)

styles_path = ROOT / 'styles.css'
styles = styles_path.read_text(encoding='utf-8')

# Journal is structural content first: flatter field groups, tighter help, and a
# two-column desktop metadata grid that naturally collapses to one column.
styles = replace_css_block(
    styles,
    '.journal-form__grid,\n.inventory-journal-form__grid',
    """  display: grid;\n  gap: clamp(0.65rem, 1.8vw, 0.9rem);\n  grid-template-columns: minmax(0, 1fr);""",
)
styles = replace_css_block(
    styles,
    '.journal-form__field,\n.inventory-journal-form__field',
    """  display: grid;\n  gap: 0.4rem;\n  padding: clamp(0.62rem, 1.7vw, 0.82rem);\n  border-radius: var(--radius-lg);\n  border: 1px solid color-mix(in srgb, var(--outline) 14%, transparent);\n  background: color-mix(in srgb, #ffffff 95%, var(--lavender) 5%);\n  min-width: 0;""",
)
styles = replace_css_block(
    styles,
    '.journal-field-hint',
    """  margin: 0;\n  font-size: 0.8rem;\n  line-height: 1.35;\n  color: color-mix(in srgb, var(--ink-soft) 82%, #fff 18%);""",
)
styles = replace_css_block(
    styles,
    '.journal-needs-summary',
    """  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 0.35rem 0.5rem;\n  padding: 0.42rem 0.55rem;\n  border-radius: var(--radius-md);\n  border: 1px solid color-mix(in srgb, var(--mint) 50%, transparent);\n  background: color-mix(in srgb, #ffffff 94%, var(--mint) 6%);""",
)
styles = replace_css_block(
    styles,
    '.journal-needs-summary__item',
    """  display: inline-flex;\n  align-items: center;\n  gap: 0.25rem;\n  padding: 0.22rem 0.42rem;\n  border-radius: var(--radius-md);\n  border: 1px solid color-mix(in srgb, var(--mint) 48%, transparent);\n  background: color-mix(in srgb, #ffffff 88%, var(--mint) 12%);\n  box-shadow: none;\n  font-size: 0.84rem;\n  color: color-mix(in srgb, var(--ink) 78%, var(--mint) 22%);""",
)

old_desktop_journal = """@media (min-width: 860px) {\n  .journal-form__sheet {\n    margin-right: clamp(0.8rem, 2.6vw, 1.6rem);\n  }\n}"""
new_desktop_journal = """@media (min-width: 860px) {\n  .journal-form__grid,\n  .inventory-journal-form__grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n\n  .journal-form__sheet {\n    margin-right: clamp(0.8rem, 2.6vw, 1.6rem);\n  }\n}"""
if styles.count(old_desktop_journal) != 1:
    raise SystemExit('styles.css: canonical desktop Journal media block drifted')
styles = styles.replace(old_desktop_journal, new_desktop_journal, 1)

mobile_replacements = {
    "  .support-journal__body {\n    padding: clamp(1rem, 5vw, 1.35rem) clamp(0.65rem, 4.5vw, 1.1rem) clamp(1.5rem, 7vw, 2.1rem);\n  }":
        "  .support-journal__body {\n    padding: clamp(0.65rem, 3.5vw, 0.9rem) clamp(0.55rem, 3vw, 0.8rem) clamp(1rem, 5vw, 1.4rem);\n  }",
    "    padding: clamp(0.4rem, 4vw, 0.7rem) 0 clamp(0.75rem, 5vw, 1rem);":
        "    padding: 0 0 clamp(0.6rem, 4vw, 0.8rem);",
    "    padding: clamp(0.55rem, 4.8vw, 0.95rem) clamp(0.45rem, 4.5vw, 0.85rem) clamp(0.75rem, 5vw, 1.15rem);":
        "    padding: clamp(0.35rem, 3vw, 0.55rem);",
    "    border-radius: var(--radius-2xl);\n    box-shadow: none;\n    background: none;\n  }\n\n  .support-journal__content .journal-form__field {\n    padding: clamp(0.55rem, 4vw, 0.85rem);\n  }":
        "    border-radius: var(--radius-lg);\n    box-shadow: none;\n    background: none;\n  }\n\n  .support-journal__content .journal-form__field {\n    padding: clamp(0.5rem, 3vw, 0.65rem);\n  }",
}
for old, new in mobile_replacements.items():
    if styles.count(old) != 1:
        raise SystemExit(f'styles.css: mobile Journal anchor drifted: {old[:70]!r}')
    styles = styles.replace(old, new, 1)

# Personal strategy form: preserve the tactile outer object, but stop making every
# field another full-weight magnet. Existing desktop contact row remains two-up.
styles = replace_css_block(
    styles,
    '.strategy-card--form',
    """  display: grid;\n  padding: clamp(0.7rem, 1.8vw, 0.95rem);\n  gap: 0.58rem;\n  border-width: 2px;\n  border-radius: var(--radius-lg);\n  background: color-mix(in srgb, var(--mint) 82%, #fff 18%);\n  box-shadow: 0 6px 0 color-mix(in srgb, var(--shadow) 52%, transparent);""",
)
styles = replace_css_block(
    styles,
    '.strategy-form',
    """  display: grid;\n  gap: 0.55rem;""",
)
styles = replace_css_block(
    styles,
    '.strategy-form__field',
    """  display: grid;\n  gap: 0.28rem;""",
)
styles = replace_css_block(
    styles,
    '.strategy-form__field label',
    """  font: inherit;\n  font-size: 0.9rem;\n  line-height: 1.2;\n  text-transform: none;\n  letter-spacing: normal;""",
)
styles = replace_css_block(
    styles,
    '.strategy-card--form .strategy-card--input',
    """  border-width: 2px;\n  border-color: color-mix(in srgb, var(--outline) 58%, transparent);\n  border-radius: var(--radius-md);\n  background: color-mix(in srgb, #fff 22%, var(--mint) 78%);\n  box-shadow: 0 3px 0 color-mix(in srgb, var(--shadow) 46%, transparent);""",
)

old_control_padding = """  width: 100%;\n  padding: 0.65rem 0.85rem;\n  border: 0;\n  background: transparent;\n  font: inherit;"""
new_control_padding = """  width: 100%;\n  min-height: 44px;\n  padding: 0.48rem 0.65rem;\n  border: 0;\n  background: transparent;\n  font: inherit;"""
if styles.count(old_control_padding) != 1:
    raise SystemExit('styles.css: strategy form control block drifted')
styles = styles.replace(old_control_padding, new_control_padding, 1)

textarea_anchor = """.strategy-card--form .strategy-card--input select {\n  appearance: none;\n}"""
textarea_replacement = """.strategy-card--form .strategy-card--input textarea {\n  min-height: 6.5rem;\n  resize: vertical;\n}\n\n.strategy-card--form .strategy-card--input select {\n  appearance: none;\n}"""
if styles.count(textarea_anchor) != 1:
    raise SystemExit('styles.css: strategy select anchor drifted')
styles = styles.replace(textarea_anchor, textarea_replacement, 1)

# Remove presentation rules whose owners were retired by the native action-control
# migration. The new .app-action component is authoritative.
for dead_selector in (
    '.strategy-card__save--profile,\n.strategy-form__submit--secondary.strategy-card__save',
    '.inventory-journal-form__actions .inventory-button',
):
    marker = f'{dead_selector} {{'
    if marker not in styles:
        raise SystemExit(f'styles.css: expected obsolete block missing: {dead_selector!r}')
    start = styles.index(marker)
    brace = styles.index('{', start)
    depth = 0
    end = None
    for index in range(brace, len(styles)):
        if styles[index] == '{':
            depth += 1
        elif styles[index] == '}':
            depth -= 1
            if depth == 0:
                end = index + 1
                break
    if end is None:
        raise SystemExit(f'styles.css: unterminated obsolete block {dead_selector!r}')
    while end < len(styles) and styles[end] == '\n':
        end += 1
    styles = styles[:start] + styles[end:]

styles_path.write_text(styles.rstrip() + '\n', encoding='utf-8')

# Permanent regression coverage for the root-owned density contract.
test_path = ROOT / 'tests/native-action-controls.test.mjs'
test_source = test_path.read_text(encoding='utf-8')
append_test = r'''

test('Journal and personal strategy density live at canonical owners across phone and desktop', () => {
  const moduleSource = read('assets/js/journal/module.js');
  const pages = read('scripts/build-pages.mjs');
  const styles = read('styles.css');
  const readme = read('README.md');

  assert.ok(moduleSource.includes("emotion: 'Use any word that fits. Leave blank if unsure.'"));
  assert.ok(moduleSource.includes("needs: 'Choose any needs that connect. Leave blank if unsure.'"));
  assert.ok(moduleSource.includes("this.needsSummaryEl.hidden = !hasSelection"));
  assert.match(styles, /@media \(min-width: 860px\)[\s\S]*?\.journal-form__grid,[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.journal-form__field,[\s\S]*?border:\s*1px solid/);
  assert.match(styles, /\.strategy-card--form \{[\s\S]*?border-width:\s*2px;[\s\S]*?box-shadow:\s*0 6px/);
  assert.match(styles, /\.strategy-card--form \.strategy-card--input \{[\s\S]*?border-width:\s*2px;[\s\S]*?box-shadow:\s*0 3px/);
  assert.ok(styles.includes('min-height: 6.5rem'));
  assert.ok(pages.includes('class=\\"strategy-card strategy-card--form\\"'), 'generated strategy forms must still originate in the page compiler');
  assert.equal(styles.includes('.inventory-journal-form__actions .inventory-button'), false);
  assert.ok(readme.includes('### Root-level UX changes'));
  assert.ok(readme.includes('Do not edit generated HTML as the source of a UI fix.'));
});
'''
if "test('Journal and personal strategy density live at canonical owners" in test_source:
    raise SystemExit('tests/native-action-controls.test.mjs: density test already exists')
test_path.write_text(test_source.rstrip() + append_test + '\n', encoding='utf-8')

# Put the authoring rule where future contributors will see it before the status log.
readme_path = ROOT / 'README.md'
readme = readme_path.read_text(encoding='utf-8')
anchor = '### Current Bedrock status\n'
if readme.count(anchor) != 1:
    raise SystemExit('README.md: Current Bedrock status anchor drifted')
root_ux = '''### Root-level UX changes\n\nBedrock changes how UI work should be made, not just how the current site happens to look. Before changing a rendered screen, trace the element back to the layer that actually owns it, then change that owner.\n\n- **Generated markup:** edit the template/compiler that emits it (normally `scripts/build-pages.mjs`), then rebuild. **Do not edit generated HTML as the source of a UI fix.**\n- **Deterministic presentation:** edit the existing component/style owner that should define the final first-paint appearance. Do not append a late corrective override merely to cancel an older rule; consolidate or remove the older rule so one layer remains authoritative.\n- **Runtime behavior:** JavaScript should own genuinely stateful behavior such as user choices, persisted data, authentication, drag state, or interaction lifecycle. It should not rewrite deterministic markup or CSS after paint just to make the page look correct.\n- **Responsive design:** start from one shared component contract. Use narrow-screen rules for genuine space constraints and wider-screen rules to use available room (for example, additional columns), rather than maintaining separate mobile and desktop versions of the same UI.\n- **Regression proof:** preserve accessibility hooks and storage contracts, add or update a focused test for the ownership/UX invariant, run the canonical build, and require zero generated diff on the clean final head.\n\nIf you cannot name the canonical markup owner, style owner, and behavior owner for the thing you are changing, trace those first. A screenshot-specific override, generated-file edit, duplicate controller, or post-paint normalizer is not a Bedrock repair.\n\n'''
readme = readme.replace(anchor, root_ux + anchor, 1)
readme_path.write_text(readme.rstrip() + '\n', encoding='utf-8')

print('Prepared root-owned Journal and personal-strategy density repair.')
