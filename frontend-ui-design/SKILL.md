---
name: frontend-ui-design
description: Use when building or modifying React, Next.js, or Backstage UI components. Enforces strict Tailwind CSS standards, responsive design breakpoints, component isolation, and accessibility (a11y) rules.
---

# Frontend UI Design & Implementation

## Overview
A backend can be perfectly architected, but if the frontend is inaccessible, unresponsive, or visually inconsistent, the user experience fails. 

This skill dictates how you design and implement user interfaces in the Skymantics ecosystem (specifically Next.js, React, and Backstage plugins).

## The Prime Directive
**Never use inline styles (`style={{ color: 'red' }}`). Always use Tailwind CSS utility classes. Never deploy a button, input, or interactive element without proper ARIA attributes.**

## Phase 1: Visual Design & Mockups

Before writing component code, you must ensure the visual design has been validated.

1. **Invoke Brainstorming:**
   - If this is a net-new UI component, you MUST invoke the `brainstorming` skill first to present visual options or terminal-based wireframes to the user.
   - Do not guess the layout. Get explicit approval on the component hierarchy first.

2. **Tailwind Typography & Colors:**
   - Avoid generic browser defaults. Use modern typography scales (e.g., `text-sm`, `text-base`, `text-lg font-semibold`).
   - Do not use harsh absolute colors (e.g., `bg-red-500`). Use harmonious palettes (e.g., slate, zinc, or brand-specific variables if defined in `tailwind.config.ts`).
   - Always account for Dark Mode using the `dark:` variant (e.g., `bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100`).

## Phase 2: Component Architecture

1. **Atomic Design:**
   - Break massive React components into smaller, pure, reusable functions.
   - If a component file exceeds 150 lines, it is likely doing too much. Extract sub-components.

2. **State Management:**
   - Keep state as local as possible.
   - Do not reach for global state (Zustand, Redux, Context) unless prop-drilling becomes severe (more than 3 levels deep).

3. **Responsive Design:**
   - Build **mobile-first**. 
   - Define the base Tailwind classes for mobile screens, then use `md:` and `lg:` prefixes to adjust layouts for tablets and desktops.
   - Example: `flex flex-col md:flex-row w-full`

## Phase 3: Accessibility (a11y) Enforcement

A UI is useless if a screen reader cannot parse it or a keyboard cannot navigate it.

1. **Semantic HTML:**
   - Use `<main>`, `<section>`, `<nav>`, and `<aside>` instead of generic `<div>` soup.
   - Ensure a strict heading hierarchy (`<h1>` -> `<h2>` -> `<h3>`). Do not skip heading levels for visual styling.

2. **Interactive Elements:**
   - All clickable elements must be actual `<button>` or `<a>` tags. Never attach `onClick` to a `<div>` or `<span>`.
   - Provide clear `focus:` states in Tailwind for keyboard navigators (e.g., `focus:ring-2 focus:ring-blue-500 outline-none`).
   - If an icon acts as a button, it MUST have `aria-label="Description"`.

3. **Feedback & Loading States:**
   - Buttons triggering async operations must visually disable and show a loading spinner or indicator.
   - Use `aria-busy="true"` on loading containers.

## Red Flags - STOP

- Using `px` instead of `rem` (Tailwind standardizes this via spacing utilities like `p-4`).
- Forgetting to handle the `empty` or `error` state of a data-fetching component.
- Leaving `console.log` statements in frontend components.

**MANDATORY:** Before concluding a UI implementation, you MUST invoke the `verification-before-completion` skill to compile the frontend (`npm run build` or `npm run dev`) and ensure no hydration errors or Tailwind class clashes exist.
