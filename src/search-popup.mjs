/**
 * @typedef {object} SearchEntry
 * @property {string} id Unique entry identifier.
 * @property {string} name Display name.
 * @property {string} searchText Normalized searchable text.
 * @property {unknown} [icon] Optional icon metadata.
 */

/**
 * @typedef {object} SearchPopupDependencies
 * @property {(query: string) => SearchEntry[]} findMatchingEntries Finds ranked matches.
 * @property {() => SearchEntry[]} getAllSidebarEntries Returns all available entries.
 * @property {(entry: SearchEntry) => void} navigateToEntry Navigates to a selected entry.
 * @property {(entry: SearchEntry) => void} addRecentEntry Persists a recent selection.
 * @property {(entries: SearchEntry[]) => SearchEntry[]} getRecentEntries Resolves recent entries from current entries.
 */

/**
 * Removes duplicate entries while preserving insertion order.
 *
 * @param {SearchEntry[]} entries Candidate entries.
 * @returns {SearchEntry[]} De-duplicated entries.
 */
function dedupeEntries(entries) {
	const seen = new Set();
	const uniqueEntries = [];

	entries.forEach((entry) => {
		if (!entry || typeof entry.id !== 'string') return;
		if (seen.has(entry.id)) return;

		seen.add(entry.id);
		uniqueEntries.push(entry);
	});

	return uniqueEntries;
}

/**
 * Injects one-time SweetAlert CSS overrides to reduce visual jitter.
 *
 * @returns {void}
 */
function ensureSwalScrollStabilityStyle() {
	const styleId = 'skill-search-swal-scroll-stability';
	if (document.getElementById(styleId)) return;

	const style = document.createElement('style');
	style.id = styleId;
	style.textContent = `
.swal2-container,
.swal2-backdrop-show,
.swal2-backdrop-hide,
.swal2-popup,
.swal2-show,
.swal2-hide {
	animation: none !important;
	transition: none !important;
}

.swal2-container {
	backdrop-filter: none !important;
	will-change: auto !important;
}

html {
	scrollbar-gutter: stable;
}

html.swal2-shown,
body.swal2-shown {
	overflow-y: auto !important;
}

body.swal2-shown {
	padding-right: 0 !important;
}
`;
	document.head.appendChild(style);
}

/**
 * Resolves the SweetAlert API available in the current Melvor runtime.
 *
 * @returns {any | null} Swal-compatible API or null when unavailable.
 */
function getSwal() {
	if (typeof SwalLocale !== 'undefined') return SwalLocale;
	if (typeof Swal !== 'undefined') return Swal;
	return null;
}

/**
 * Applies readability adjustments to popup label and input text.
 *
 * @param {HTMLElement} popup Active popup root element.
 * @returns {void}
 */
function applyPopupTextStyles(popup) {
	if (!(popup instanceof HTMLElement)) return;

	const label = popup.querySelector('.swal2-input-label');
	if (label instanceof HTMLElement) {
		label.style.setProperty('color', 'var(--bs-light, #f8f9fa)', 'important');
	}

	const input = popup.querySelector('.swal2-input');
	if (input instanceof HTMLElement) {
		input.style.setProperty('color', 'var(--bs-light, #f8f9fa)', 'important');
	}
}

/**
 * Creates a clickable suggestion row for a single entry.
 *
 * @param {SearchEntry} entry Suggestion entry.
 * @param {string} textColor Computed input text color.
 * @param {() => void} onClick Click handler.
 * @param {() => void} onMouseEnter Hover handler.
 * @returns {HTMLButtonElement}
 */
function createSuggestionRow(entry, textColor, onClick, onMouseEnter) {
	const row = document.createElement('button');
	row.type = 'button';
	row.className = 'skill-search-row';
	row.style.width = '100%';
	row.style.display = 'flex';
	row.style.alignItems = 'center';
	row.style.gap = '0.5rem';
	row.style.padding = '0.45rem 0.6rem';
	row.style.border = '0';
	row.style.borderBottom = '1px solid rgba(255,255,255,0.12)';
	row.style.background = 'transparent';
	row.style.color = textColor;
	row.style.textAlign = 'left';
	row.style.cursor = 'pointer';

	row.addEventListener('mouseenter', onMouseEnter);

	const icon = createEntryIcon(entry.icon);
	if (icon) row.appendChild(icon);

	const name = document.createElement('span');
	name.textContent = entry.name;
	row.appendChild(name);

	row.addEventListener('click', onClick);

	return row;
}

/**
 * Converts icon metadata into a renderable DOM element.
 *
 * @param {{kind?: string, value?: string} | null | undefined} iconData Stored icon metadata.
 * @returns {HTMLElement | null} Renderable icon element or null when not available.
 */
function createEntryIcon(iconData) {
	if (!iconData || typeof iconData !== 'object') return null;

	if (iconData.kind === 'image') {
		const icon = document.createElement('img');
		icon.src = iconData.value;
		icon.alt = '';
		icon.width = 20;
		icon.height = 20;
		icon.style.flex = '0 0 auto';
		return icon;
	}

	if (iconData.kind === 'class') {
		const icon = document.createElement('i');
		icon.className = iconData.value;
		icon.style.width = '20px';
		icon.style.textAlign = 'center';
		icon.style.flex = '0 0 auto';
		return icon;
	}

	return null;
}

/**
 * Builds and manages the live suggestion dropdown under the popup input.
 *
 * @param {HTMLElement} popup Popup root element.
 * @param {any} popupApi Swal-compatible popup API.
 * @param {() => void} onSelect Callback executed after selecting an entry.
 * @param {SearchPopupDependencies} dependencies Search and navigation dependencies.
 * @returns {void}
 */
function setupSkillSuggestionDropdown(popup, popupApi, onSelect, dependencies) {
	const {
		findMatchingEntries,
		getAllSidebarEntries,
		navigateToEntry,
		addRecentEntry,
		getRecentEntries,
	} = dependencies;

	if (!(popup instanceof HTMLElement)) return;

	const input = popup.querySelector('.swal2-input');
	if (!(input instanceof HTMLInputElement)) return;

	const dropdown = document.createElement('div');
	dropdown.className = 'skill-search-dropdown';

	const inputStyle = window.getComputedStyle(input);
	dropdown.style.width = `${input.offsetWidth}px`;
	dropdown.style.margin = '0.25rem auto 0 auto';
	dropdown.style.maxHeight = '240px';
	dropdown.style.overflowY = 'auto';
	dropdown.style.background = inputStyle.backgroundColor;
	dropdown.style.border = inputStyle.border;
	dropdown.style.borderRadius = inputStyle.borderRadius;
	dropdown.style.color = inputStyle.color;
	dropdown.style.boxSizing = 'border-box';

	input.insertAdjacentElement('afterend', dropdown);

	const state = {
		matches: [],
		activeIndex: -1,
	};

	const selectEntry = (entry) => {
		if (!entry) return;
		input.value = entry.name;
		onSelect();
		addRecentEntry(entry);
		navigateToEntry(entry);
		popupApi.close();
	};

	// Keeps visual highlight state in sync with keyboard/mouse selection.
	const setActiveIndex = (nextIndex) => {
		if (state.matches.length === 0) {
			state.activeIndex = -1;
			return;
		}

		const max = state.matches.length - 1;
		state.activeIndex = Math.max(0, Math.min(nextIndex, max));

		const rows = Array.from(dropdown.querySelectorAll('.skill-search-row'));
		rows.forEach((row, index) => {
			if (!(row instanceof HTMLElement)) return;
			if (index === state.activeIndex) {
				row.style.background = 'rgba(255,255,255,0.2)';
				row.scrollIntoView({ block: 'nearest' });
			} else {
				row.style.background = 'transparent';
			}
		});
	};

	const updateSuggestions = () => {
		const query = input.value.trim().toLowerCase();
		const allEntries = getAllSidebarEntries();
		const recentEntries = getRecentEntries(allEntries);

		const matches = query
			? dedupeEntries([
				...recentEntries.filter((entry) => entry.searchText.includes(query)),
				...findMatchingEntries(query),
			]).slice(0, 8)
			: dedupeEntries([...recentEntries, ...allEntries]).slice(0, 8);
		state.matches = matches;
		state.activeIndex = matches.length > 0 ? 0 : -1;

		dropdown.replaceChildren(
			...matches.map((entry, index) =>
				createSuggestionRow(entry, inputStyle.color, () => {
					state.activeIndex = index;
					selectEntry(entry);
				}, () => setActiveIndex(index)),
			),
		);

		setActiveIndex(state.activeIndex);
	};

	updateSuggestions();
	input.addEventListener('input', updateSuggestions);

	// Keyboard navigation for fast selection.
	input.addEventListener('keydown', (event) => {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			setActiveIndex(state.activeIndex + 1);
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			setActiveIndex(state.activeIndex - 1);
			return;
		}

		if (event.key === 'Enter' && state.activeIndex >= 0) {
			event.preventDefault();
			selectEntry(state.matches[state.activeIndex]);
		}
	});
}

/**
 * Opens the search popup and navigates to the selected or best-matching entry.
 *
 * @param {SearchPopupDependencies} dependencies Search and navigation dependencies.
 * @returns {Promise<void>}
 */
export async function openSkillSearchPopup(dependencies) {
	const {
		findMatchingEntries,
		getAllSidebarEntries,
		navigateToEntry,
		addRecentEntry,
	} = dependencies;

	if (
		typeof findMatchingEntries !== 'function'
		|| typeof getAllSidebarEntries !== 'function'
		|| typeof navigateToEntry !== 'function'
		|| typeof addRecentEntry !== 'function'
	) {
		console.warn('SkillSearch: Popup dependencies are not available.');
		return;
	}

	const popupApi = getSwal();
	if (!popupApi) {
		console.warn('SkillSearch: Swal API not available in this context.');
		return;
	}

	let selectedFromDropdown = false;
	ensureSwalScrollStabilityStyle();

	const firstStep = await popupApi.fire({
		title: 'Skill Search',
		input: 'text',
		inputPlaceholder: 'Type a skill name',
		scrollbarPadding: false,
		heightAuto: false,
		showClass: {
			backdrop: '',
			popup: '',
			icon: '',
		},
		hideClass: {
			backdrop: '',
			popup: '',
			icon: '',
		},
		didOpen: (popup) => {
			applyPopupTextStyles(popup);
			setupSkillSuggestionDropdown(popup, popupApi, () => {
				selectedFromDropdown = true;
			}, dependencies);
		},
		showCancelButton: true,
		confirmButtonText: 'Search',
		inputValidator: (value) => {
			if (!value || !value.trim()) return 'Enter a skill name.';
			return null;
		},
	});

	if (selectedFromDropdown || !firstStep.isConfirmed) return;

	const rawValue = String(firstStep.value ?? '').trim();
	const query = rawValue.toLowerCase();
	const matches = findMatchingEntries(query);
	const exactMatch = matches.find((entry) => entry.name.toLowerCase() === query);

	if (exactMatch) {
		addRecentEntry(exactMatch);
		navigateToEntry(exactMatch);
		return;
	}

	if (matches.length === 0) {
		await popupApi.fire({
			icon: 'info',
			title: 'No results found',
			text: `No result matched "${rawValue}".`,
		});
		return;
	}

	addRecentEntry(matches[0]);
	navigateToEntry(matches[0]);
}
