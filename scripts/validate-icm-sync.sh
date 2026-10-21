#!/bin/bash
# validate-icm-sync.sh
# Checks that the skill files say what the ICM stage contracts say.
#
# The ICM template (icm-workspace-template/specs/.sdd/) is the source of truth for the v3 pipeline:
# it is what Cursor, Claude Code and the Grok CLI actually run. Each stage SKILL.md is its portable
# summary. Counting gates and roles cannot tell a summary from a contradiction, so the checks that
# fail are about content:
#
#   1. Anchors   — rule phrases that must appear in BOTH the stage CONTEXT.md and its SKILL.md
#   2. Forbidden — v2 rules that contradict v3 and must not appear in any SKILL.md
#   3. Rosters   — Stage 02 / 05 Blue and Red rosters are identical (hosts parse them)
#   4. Shared    — shared/*.md equals _config/*.md (visual-companion.md is path-adapted: anchors only)
#
# Gate / role counts are still printed, as information.
#
# Usage: ./scripts/validate-icm-sync.sh [SKILLS_DIR] [ICM_DIR]
# Compatible with Bash 3.2 (macOS /bin/bash).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="${1:-$(dirname "$SCRIPT_DIR")}"
ICM_DIR="${2:-$SKILLS_DIR/icm-workspace-template/specs/.sdd}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

FAILS=0
fail() { echo -e "${RED}✗ FAIL${NC}   $*"; FAILS=$((FAILS + 1)); }
ok() { echo -e "${GREEN}✓ OK${NC}     $*"; }
info() { echo -e "${YELLOW}ℹ INFO${NC}   $*"; }

STAGES=(01_brainstorming 02_adversarial_swarm_analysis 03_interactive_wireframing 04_writing_implementation_phases 05_development_swarm 06_visual_acceptance_testing 07_verification_before_completion)
SKILLS=(brainstorming adversarial-swarm-analysis interactive-wireframing writing-implementation-phases development-swarm visual-acceptance-testing verification-before-completion)

# Anchors: "stage|phrase" — case-insensitive fixed strings required in both files.
ANCHORS="
01_brainstorming|UNSPECIFIED
01_brainstorming|01-interpretations.md
01_brainstorming|archive
01_brainstorming|calendar
01_brainstorming|domain-expert
01_brainstorming|example.com
02_adversarial_swarm_analysis|interpretation diff
02_adversarial_swarm_analysis|maxRedTeamRounds
02_adversarial_swarm_analysis|Findings: API
02_adversarial_swarm_analysis|02-deferred-ui.md
02_adversarial_swarm_analysis|sibling container
02_adversarial_swarm_analysis|fallback
02_adversarial_swarm_analysis|forced failures
03_interactive_wireframing|token-audit --stage 03
03_interactive_wireframing|--detach
03_interactive_wireframing|preflight
03_interactive_wireframing|waves
03_interactive_wireframing|port_changed
04_writing_implementation_phases|--claim
04_writing_implementation_phases|grader-ready
04_writing_implementation_phases|two-build
04_writing_implementation_phases|idempotency-key-reuse
04_writing_implementation_phases|@keyboard
04_writing_implementation_phases|sibling container
05_development_swarm|sdd.cjs phase --completed
05_development_swarm|Status block
05_development_swarm|hard stop
05_development_swarm|Runtime by path
05_development_swarm|Shared kernel first
05_development_swarm|Internal tests
05_development_swarm|Max 5 iterations per component
06_visual_acceptance_testing|token-audit --stage 06
06_visual_acceptance_testing|BLOCKED
06_visual_acceptance_testing|--repeat-each=20
06_visual_acceptance_testing|absent
"

# v2 rules that v3 removed. None may survive in a skill file.
FORBIDDEN="
Iteration 1 = ALWAYS FAIL
documented iterations
attack harder
to match implementation
TDD:** ! write tests before logic
"

echo "============================================"
echo "  SDD Skills ↔ ICM Template Sync Validator"
echo "============================================"
echo ""
echo "Skills dir: $SKILLS_DIR"
echo "ICM dir:    $ICM_DIR"
echo ""

skill_for() {
  local i=0
  while [ $i -lt ${#STAGES[@]} ]; do
    if [ "${STAGES[$i]}" = "$1" ]; then echo "$SKILLS_DIR/${SKILLS[$i]}/SKILL.md"; return; fi
    i=$((i + 1))
  done
}

# --- 1. Anchors ---
echo "-- anchors (rule phrases in both CONTEXT.md and SKILL.md)"
echo "$ANCHORS" | while IFS='|' read -r stage phrase; do
  [ -n "$stage" ] || continue
  ctx="$ICM_DIR/$stage/CONTEXT.md"
  skl="$(skill_for "$stage")"
  missing=""
  grep -qiF -- "$phrase" "$ctx" 2>/dev/null || missing="CONTEXT.md"
  grep -qiF -- "$phrase" "$skl" 2>/dev/null || missing="${missing:+$missing + }SKILL.md"
  if [ -n "$missing" ]; then echo "FAIL|$stage: \"$phrase\" missing in $missing"; fi
done > /tmp/sdd-sync-anchors.$$ || true
if [ -s /tmp/sdd-sync-anchors.$$ ]; then
  while IFS='|' read -r _ msg; do fail "$msg"; done < /tmp/sdd-sync-anchors.$$
else
  ok "$(echo "$ANCHORS" | grep -c '|') anchor(s) present in both files"
fi
rm -f /tmp/sdd-sync-anchors.$$

# --- 2. Forbidden v2 rules ---
echo ""
echo "-- forbidden v2 rules in skill files"
hits=0
while IFS= read -r phrase; do
  [ -n "$phrase" ] || continue
  for s in "${SKILLS[@]}" spec-driven-development; do
    f="$SKILLS_DIR/$s/SKILL.md"
    if [ -f "$f" ] && grep -qF -- "$phrase" "$f"; then fail "$s/SKILL.md still says \"$phrase\""; hits=$((hits + 1)); fi
  done
done <<EOF
$FORBIDDEN
EOF
[ "$hits" -eq 0 ] && ok "no v2 rule survives in a skill file"

# --- 3. Rosters (Stage 02 and 05) ---
echo ""
echo "-- rosters"
roles_line() { # file, heading substring → the first "Roles:" line after that heading
  awk -v h="$2" 'index($0,h) && /^#/ {on=1; next} on && /^#/ {exit} on && /^Roles:/ {print; exit}' "$1"
}
numbered() { # file, heading substring → "1. **Name:**" names in that section
  awk -v h="$2" 'index($0,h) && /^#/ {on=1; next} on && /^#/ {exit} on' "$1" | sed -n 's/^[0-9][0-9]*\. \*\*\([^*:]*\):*\*\*.*/\1/p'
}
check_roster() { # label, ctx, skill, heading, kind
  local a b
  if [ "$5" = "roles" ]; then a="$(roles_line "$2" "$4")"; b="$(roles_line "$3" "$4")"; else a="$(numbered "$2" "$4")"; b="$(numbered "$3" "$4")"; fi
  if [ -z "$a" ]; then fail "$1: no roster under \"$4\" in CONTEXT.md"
  elif [ "$a" != "$b" ]; then fail "$1 differs — CONTEXT: $(echo $a) | SKILL: $(echo $b)"
  else ok "$1"; fi
}
C02="$ICM_DIR/02_adversarial_swarm_analysis/CONTEXT.md"; S02="$SKILLS_DIR/adversarial-swarm-analysis/SKILL.md"
C05="$ICM_DIR/05_development_swarm/CONTEXT.md"; S05="$SKILLS_DIR/development-swarm/SKILL.md"
check_roster "02 Blue roster" "$C02" "$S02" "Creator Swarm" roles
check_roster "02 Red roster" "$C02" "$S02" "Critic Council" numbered
check_roster "05 Blue roster" "$C05" "$S05" "Implementation Swarm" roles
check_roster "05 Red roster" "$C05" "$S05" "Validation Swarm" roles

# --- 4. shared/ ↔ _config/ ---
echo ""
echo "-- shared/ ↔ _config/"
for f in "$SKILLS_DIR"/shared/*.md; do
  b="$(basename "$f")"
  c="$ICM_DIR/_config/$b"
  if [ ! -f "$c" ]; then fail "shared/$b has no _config/$b"; continue; fi
  if [ "$b" = "visual-companion.md" ]; then
    # Script paths differ by design ({{SKILLS_DIR}} vs specs/.sdd/scripts); the rules must not.
    for phrase in 'port_changed' '--detach' 'current-server.json'; do
      grep -qF -- "$phrase" "$f" && grep -qF -- "$phrase" "$c" || fail "visual-companion.md: \"$phrase\" not in both copies"
    done
    continue
  fi
  if cmp -s "$f" "$c"; then ok "shared/$b = _config/$b"; else fail "shared/$b differs from _config/$b (edit _config, then copy to shared/)"; fi
done

# --- Information: structural counts ---
echo ""
echo "-- structure (information only: a summary need not repeat every gate)"
i=0
while [ $i -lt ${#STAGES[@]} ]; do
  ctx="$ICM_DIR/${STAGES[$i]}/CONTEXT.md"; skl="$SKILLS_DIR/${SKILLS[$i]}/SKILL.md"
  if [ -f "$ctx" ] && [ -f "$skl" ]; then
    cg=$(grep -c '⛔ GATE' "$ctx" || true); sg=$(grep -c '⛔ GATE' "$skl" || true)
    info "${STAGES[$i]}: ⛔ GATE markers CONTEXT $cg · SKILL $sg"
  fi
  i=$((i + 1))
done

echo ""
echo "============================================"
if [ "$FAILS" -eq 0 ]; then
  echo -e "${GREEN}✓ skills and ICM stage contracts agree${NC}"
  exit 0
fi
echo -e "${RED}✗ $FAILS check(s) failed${NC} — the ICM CONTEXT.md is canonical: fix the SKILL.md (or shared/) to match it."
exit 1
