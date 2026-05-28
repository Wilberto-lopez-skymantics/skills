# DESIGN.md Template & Standards

This file defines the canonical template and validation rules for `specs/DESIGN.md`. It is referenced by:
- `brainstorming/SKILL.md` — creates the initial DESIGN.md using this template
- `spec-driven-development/SKILL.md` — verifies DESIGN.md exists and conforms
- `interactive-wireframing/SKILL.md` — reads tokens to generate wireframes
- `development-swarm/SKILL.md` — Frontend Engineer and Design Token Auditor use these tokens

---

## Template

```markdown
---
name: <Design System Name>
colors:
  primary: "#1A1C1E"
  surface: "#FFFFFF"
  border: "#E0E0E0"
  accent: "#B8422E"
  on-accent: "#FFFFFF"
  text-main: "#1A1C1E"
  text-secondary: "#6C7278"
  text-muted: "#9CA3AF"
  status-success: "#22C55E"
  status-warning: "#F59E0B"
  status-error: "#EF4444"
typography:
  h1:
    fontFamily: "Public Sans"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.2
  h2:
    fontFamily: "Public Sans"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Public Sans"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Public Sans"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Public Sans"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
  full: "9999px"
elevation:
  shadow-sm: "0 1px 2px rgba(0,0,0,0.05)"
  shadow-md: "0 4px 6px rgba(0,0,0,0.1)"
  shadow-lg: "0 10px 15px rgba(0,0,0,0.15)"
transitions:
  duration-fast: "100ms"
  duration-normal: "200ms"
  duration-slow: "400ms"
  easing-default: "cubic-bezier(0.4, 0, 0.2, 1)"
iconography:
  set: "Lucide"
  defaultSize: "20px"
  strokeWidth: "1.5px"
feedback:
  toast-position: "bottom-center"
  toast-duration: "3000ms"
  error-style: "inline"
  loading-indicator: "spinner"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.sm}"
    hover:
      backgroundColor: "#9A3222"
    focus:
      outline: "2px solid {colors.accent}"
      outlineOffset: "2px"
    disabled:
      backgroundColor: "{colors.text-secondary}"
      textColor: "{colors.text-muted}"
      cursor: "not-allowed"
---

## Overview
Rationale behind the design system. Note: This document is primarily used to bootstrap the interactive wireframing phase. Once wireframes are generated and approved, those wireframes supersede this document as the absolute visual source of truth for the development swarm.

## Colors
Explanation of the palette.

## Typography
Explanation of font choices.

## Layout
Explanation of component placement and spatial rules.

## Approved Wireframes
A structured list of approved HTML wireframes/mockups. Populated by the `interactive-wireframing` skill. For each screen (e.g., Main Menu, Gameplay HUD), include:
- A clickable link to the approved wireframe file (e.g., `[main-menu.html](file:///absolute/path/to/specs/wireframes/main-menu.html)`).
- A description of the HTML layout structure, elements, and CSS class names used.

## UI State Matrix
| Component | Empty | Loading | Success | Error | Edge Case |
|-----------|-------|---------|---------|-------|-----------|
| Component Name | Description | Description | Description | Description | Description |
```

---

## Design Token Completeness Checklist

<HARD-GATE>
DESIGN.md CANNOT be written until every category below has defined tokens. The agent is responsible for generating best-practice default tokens matching the approved theme for all categories, so the user does not need to define them manually.
</HARD-GATE>

| # | Token Category | Required Tokens | Mandatory? |
|---|----------------|-----------------|:---:|
| 1 | **Colors** | primary, surface, border, accent, text (3 levels), status-success, status-warning, status-error, on-accent | ✅ Always |
| 2 | **Typography** | h1, h2, body, caption, label — each with fontFamily, fontSize, fontWeight, lineHeight | ✅ Always |
| 3 | **Spacing** | xs, sm, md, lg, xl | ✅ Always |
| 4 | **Border Radii** | sm, md, lg, full | ✅ Always |
| 5 | **Elevation/Shadows** | shadow-sm, shadow-md, shadow-lg (or explicit "none" with justification) | Conditional: if project has depth/layering |
| 6 | **Interaction States** | hover, focus, active, disabled for every interactive component | ✅ Always |
| 7 | **Transitions** | duration-fast, duration-normal, duration-slow, easing-default (or explicit "no animations" with reason) | ✅ Always |
| 8 | **Iconography** | icon set name, default size, stroke width | ✅ Always |
| 9 | **Data Visualization** | marker sizes, line weights, glow/shadow params | Conditional: if project has charts/maps |
| 10 | **Feedback Patterns** | toast position + duration, error styling, loading indicator style | Conditional: if project has async operations |

---

## Interaction State YAML Convention

Interactive components MUST define nested state objects in the YAML front matter:

```yaml
components:
  send-button:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    hover:
      backgroundColor: "{colors.accent}DD"
    focus:
      outline: "2px solid {colors.accent}"
      outlineOffset: "2px"
    disabled:
      backgroundColor: "{colors.secondary}"
      textColor: "{colors.text-muted}"
      cursor: "not-allowed"
```

---

## Component Naming Convention (DESIGN.md ↔ SPEC.md)

Component names in DESIGN.md's `components:` YAML section MUST use kebab-case versions of the PascalCase names in SPEC.md's Component Hierarchy:

```
SPEC.md: ChatCard[user]  →  DESIGN.md: chat-card-user
SPEC.md: DragHandle      →  DESIGN.md: drag-handle
SPEC.md: MapViewer        →  DESIGN.md: map-viewer
```

**Hard Rule:** If a `DESIGN.md` exists, it is the authoritative source for all visual values. The Development Swarm MUST read it before generating any frontend component code.
