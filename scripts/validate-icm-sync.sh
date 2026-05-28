#!/bin/bash
# validate-icm-sync.sh
# Validates that ICM CONTEXT.md files haven't drifted from their source SKILL.md files.
# Compares structural elements: gates, persona counts, and output file references.
#
# Usage: ./scripts/validate-icm-sync.sh [SKILLS_DIR] [ICM_DIR]
#   SKILLS_DIR: path to the skills directory (default: parent of this script's directory)
#   ICM_DIR:    path to the ICM template (default: SKILLS_DIR/icm-workspace-template/specs/.sdd)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="${1:-$(dirname "$SCRIPT_DIR")}"
ICM_DIR="${2:-$SKILLS_DIR/icm-workspace-template/specs/.sdd}"

# Mapping: ICM stage folder → skill name (using parallel arrays for bash 3 compat)
STAGES=(
  "01_brainstorming"
  "02_adversarial_swarm_analysis"
  "03_interactive_wireframing"
  "04_writing_implementation_phases"
  "05_development_swarm"
  "06_visual_acceptance_testing"
  "07_verification_before_completion"
)
SKILLS=(
  "brainstorming"
  "adversarial-swarm-analysis"
  "interactive-wireframing"
  "writing-implementation-phases"
  "development-swarm"
  "visual-acceptance-testing"
  "verification-before-completion"
)

DRIFT_COUNT=0
CHECKED_COUNT=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo "============================================"
echo "  SDD Skills ↔ ICM Template Sync Validator"
echo "============================================"
echo ""
echo "Skills dir: $SKILLS_DIR"
echo "ICM dir:    $ICM_DIR"
echo ""

# --- Helper: extract structural elements from a markdown file ---

extract_gates() {
  local count
  count=$(grep -c '⛔ GATE' "$1" 2>/dev/null) || count=0
  echo "$count" | head -1 | tr -d '[:space:]'
}

extract_personas() {
  # Count numbered persona lines (e.g., "1. **Core Architect:**")
  local count
  count=$(grep -cE '^\s*[0-9]+\.\s+\*\*' "$1" 2>/dev/null) || count=0
  echo "$count" | head -1 | tr -d '[:space:]'
}

extract_output_files() {
  # Extract file paths from ## Outputs section
  sed -n '/^## Outputs/,/^## /p' "$1" 2>/dev/null | grep -oE '`[^`]+`' | sort || true
}

# --- Validate each stage ---

i=0
while [ $i -lt ${#STAGES[@]} ]; do
  stage="${STAGES[$i]}"
  skill_name="${SKILLS[$i]}"
  context_file="$ICM_DIR/$stage/CONTEXT.md"
  skill_file="$SKILLS_DIR/$skill_name/SKILL.md"
  i=$((i + 1))

  if [ ! -f "$context_file" ]; then
    echo -e "${RED}✗ MISSING${NC} $stage/CONTEXT.md"
    DRIFT_COUNT=$((DRIFT_COUNT + 1))
    continue
  fi

  if [ ! -f "$skill_file" ]; then
    echo -e "${YELLOW}⚠ SKIP${NC}    $stage — no matching skill at $skill_name/SKILL.md"
    continue
  fi

  CHECKED_COUNT=$((CHECKED_COUNT + 1))
  stage_drift=0

  # Compare gate counts
  context_gates=$(extract_gates "$context_file")
  skill_gates=$(extract_gates "$skill_file")
  if [ "$context_gates" -ne "$skill_gates" ]; then
    echo -e "${YELLOW}⚠ DRIFT${NC}  $stage: Gate count differs (CONTEXT: $context_gates, SKILL: $skill_gates)"
    stage_drift=1
  fi

  # Compare persona counts
  context_personas=$(extract_personas "$context_file")
  skill_personas=$(extract_personas "$skill_file")
  if [ "$context_personas" -ne "$skill_personas" ]; then
    echo -e "${YELLOW}⚠ DRIFT${NC}  $stage: Persona count differs (CONTEXT: $context_personas, SKILL: $skill_personas)"
    stage_drift=1
  fi

  # Compare output sections
  context_outputs=$(extract_output_files "$context_file")
  skill_outputs=$(extract_output_files "$skill_file")
  if [ "$context_outputs" != "$skill_outputs" ]; then
    echo -e "${YELLOW}⚠ DRIFT${NC}  $stage: Output files differ"
    echo "         CONTEXT: $(echo "$context_outputs" | tr '\n' ' ')"
    echo "         SKILL:   $(echo "$skill_outputs" | tr '\n' ' ')"
    stage_drift=1
  fi

  if [ "$stage_drift" -eq 0 ]; then
    echo -e "${GREEN}✓ OK${NC}     $stage ↔ $skill_name"
  else
    DRIFT_COUNT=$((DRIFT_COUNT + 1))
  fi
done

# --- Check for ICM-only stages (like backprop) ---
echo ""
for dir in "$ICM_DIR"/*/; do
  stage_name=$(basename "$dir")
  found=0
  j=0
  while [ $j -lt ${#STAGES[@]} ]; do
    if [ "$stage_name" = "${STAGES[$j]}" ]; then
      found=1
      break
    fi
    j=$((j + 1))
  done
  if [ "$found" -eq 0 ] && [ -f "$dir/CONTEXT.md" ]; then
    echo -e "${GREEN}ℹ INFO${NC}   $stage_name — ICM-only stage (no skill counterpart)"
  fi
done

# --- Summary ---
echo ""
echo "============================================"
if [ "$DRIFT_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✓ All $CHECKED_COUNT stages in sync${NC}"
  exit 0
else
  echo -e "${RED}✗ $DRIFT_COUNT stage(s) with drift out of $CHECKED_COUNT checked${NC}"
  echo "  Review drifted stages and update either the SKILL.md or CONTEXT.md."
  exit 1
fi
