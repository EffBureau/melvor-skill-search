# Skill Search

A Melvor Idle mod that adds fast sidebar search with keyboard navigation, recent selections, and configurable hotkeys.

## Features

- Adds a Skill Search action under the Modding sidebar category.
- Opens a searchable popup for skill navigation.
- Prioritizes recent selections when showing suggestions.
- Supports keyboard navigation in suggestions:
  - Arrow Up / Arrow Down to move selection
  - Enter to select
- Hotkey support (default: Ctrl+K).
- Hotkey configuration through Mod Settings when available.
- Automatic fallback to a sidebar settings entry when Mod Settings API is unavailable.

## Project Structure

- manifest.json: Mod metadata and setup entry point.
- src/setup.mjs: Runtime wiring and module loading via loadModule.
- src/main.mjs: Sidebar registration and keyboard listener bootstrap.
- src/search-popup.mjs: Popup UI, suggestions, and selection flow.
- src/sidebar-search.mjs: Sidebar entry discovery, filtering, ranking, and navigation.
- src/recent-searches.mjs: Recent-entry persistence.
- src/hotkey-settings.mjs: Hotkey parsing, matching, and settings integration.
- assets/: Static resources for the mod.

## Runtime Notes

- The mod uses Creator Toolkit module loading through setup + loadModule.
- No static relative imports are used between module files.
- Settings registration prefers the context settings API and also supports context resolution via mod.getContext(import.meta).

## Settings

When Mod Settings is available, Skill Search registers settings under:

- Section: General
- Setting: Search Hotkey
- Action: Record Hotkey

If Mod Settings is not available in the runtime, a fallback settings item is added beneath Modding -> Mod Settings.