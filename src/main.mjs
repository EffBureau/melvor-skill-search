export function init() {
	registerSidebarButton();

	document.addEventListener('keydown', (e) => {
		if (!e.ctrlKey || e.key.toLowerCase() !== 'k') return;
		if (isTypingInField(e.target)) return;

		e.preventDefault();
		void openSkillSearchPopup();
	});
}

function registerSidebarButton() {
	if (typeof sidebar === 'undefined' || typeof sidebar.category !== 'function') {
		console.warn('SkillSearch: Sidebar API not available in this context.');
		return;
	}

	sidebar.category('General').item('SkillSearch:Open', {
		name: 'Skill Search',
		onClick: () => {
			void openSkillSearchPopup();
		},
	});
}

function isTypingInField(target) {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;

	const tagName = target.tagName.toLowerCase();
	return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function getSwal() {
	if (typeof SwalLocale !== 'undefined') return SwalLocale;
	if (typeof Swal !== 'undefined') return Swal;
	return null;
}

async function openSkillSearchPopup() {
	const popupApi = getSwal();
	if (!popupApi) {
		console.warn('SkillSearch: Swal API not available in this context.');
		return;
	}

	let selectedFromDropdown = false;

	const firstStep = await popupApi.fire({
		title: 'Skill Search',
		input: 'text',
		inputLabel: 'Type a skill name',
		inputPlaceholder: 'e.g. Woodcutting',
		didOpen: (popup) => {
			applyPopupTextStyles(popup);
			setupSkillSuggestionDropdown(popup, popupApi, () => {
				selectedFromDropdown = true;
			});
		},
		showCancelButton: true,
		confirmButtonText: 'Search',
		inputValidator: (value) => {
			if (!value || !value.trim()) return 'Enter a skill name.';
			return null;
		},
	});

	if (selectedFromDropdown) return;
	if (!firstStep.isConfirmed) return;

	const query = String(firstStep.value ?? '').trim().toLowerCase();
	const matches = findMatchingEntries(query);
	const exactMatch = matches.find((entry) => entry.name.toLowerCase() === query);

	if (exactMatch) {
		navigateToEntry(exactMatch);
		return;
	}

	if (matches.length === 0) {
		await popupApi.fire({
			icon: 'info',
			title: 'No results found',
			text: `No result matched "${firstStep.value}".`,
		});
		return;
	}

	if (matches.length === 1) {
		navigateToEntry(matches[0]);
		return;
	}

	navigateToEntry(matches[0]);
}

function setupSkillSuggestionDropdown(popup, popupApi, onSelect) {
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
		navigateToEntry(entry);
		popupApi.close();
	};

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
		const matches = query ? findMatchingEntries(query).slice(0, 8) : getAllSidebarEntries().slice(0, 8);
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

		if (matches.length > 1) {
			setActiveIndex(0);
		}
		setActiveIndex(state.activeIndex);
	};

	updateSuggestions();
	input.addEventListener('input', updateSuggestions);
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
	if (icon) {
		row.appendChild(icon);
	}

	const name = document.createElement('span');
	name.textContent = entry.name;
	row.appendChild(name);

	row.addEventListener('click', onClick);

	return row;
}

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

function extractIconData(linkEl) {
	if (!(linkEl instanceof HTMLElement)) return null;

	const imageIcon = linkEl.querySelector('img');
	if (imageIcon instanceof HTMLImageElement && imageIcon.src) {
		return { kind: 'image', value: imageIcon.src };
	}

	const classIcon = linkEl.querySelector('i, .nav-main-link-icon, .skill-icon-xs, .skill-icon-sm');
	if (classIcon instanceof HTMLElement && classIcon.className) {
		return { kind: 'class', value: classIcon.className };
	}

	return null;
}

function getAnchorDisplayName(linkEl) {
	if (!(linkEl instanceof HTMLElement)) return '';

	const named = linkEl.querySelector('.nav-main-link-name, .name, .font-w600');
	if (named instanceof HTMLElement && named.textContent) {
		return named.textContent.trim();
	}

	return linkEl.textContent?.trim() ?? '';
}

function buildEntryFromAnchor(linkEl, categoryName, index, order) {
	if (!(linkEl instanceof HTMLAnchorElement)) return null;

	const name = getAnchorDisplayName(linkEl);
	if (!name) return null;
	if (name === 'Skill Search') return null;

	const href = linkEl.getAttribute('href') ?? '';
	const id = `${categoryName}:${name}:${href}:${index}`;
	const searchText = name.toLowerCase();

	return {
		id,
		name,
		href,
		searchText,
		order,
		icon: extractIconData(linkEl),
		navigate: () => {
			linkEl.click();
		},
	};
}

function getAllSidebarEntries() {
	const seen = new Set();
	const entries = [];
	let order = 0;
	const allowedNames = getAllowedEntryNames();

	const orderedAnchors = document.querySelectorAll('#sidebar .nav-main a, .sidebar .nav-main a, .nav-main a');
	if (orderedAnchors.length > 0) {
		Array.from(orderedAnchors).forEach((linkEl, index) => {
			if (!(linkEl instanceof HTMLAnchorElement)) return;
			const entry = buildEntryFromAnchor(linkEl, 'Sidebar', index, order++);
			if (!entry) return;
			if (!allowedNames.has(entry.name.toLowerCase())) return;

			const key = `${entry.name.toLowerCase()}|${linkEl.getAttribute('href') ?? ''}`;
			if (seen.has(key)) return;
			seen.add(key);
			entries.push(entry);
		});
	}

	if (entries.length > 0) {
		debugLogSidebarEntries(entries);
		return entries;
	}

	if (typeof sidebar?.categories === 'function') {
		const categories = sidebar.categories();
		categories.forEach((category) => {
			const categoryName = String(category?.id ?? 'General').trim();
			const anchors = category?.rootEl?.querySelectorAll('a');
			if (!anchors) return;

			Array.from(anchors).forEach((linkEl, index) => {
				if (!(linkEl instanceof HTMLAnchorElement)) return;
				const entry = buildEntryFromAnchor(linkEl, categoryName, index, order++);
				if (!entry) return;
				if (!allowedNames.has(entry.name.toLowerCase())) return;

				const key = `${entry.name.toLowerCase()}|${linkEl.getAttribute('href') ?? ''}`;
				if (seen.has(key)) return;
				seen.add(key);
				entries.push(entry);
			});
		});
	}

	const fallbackAnchors = document.querySelectorAll('#sidebar a, .sidebar a, .nav-main a');
	Array.from(fallbackAnchors).forEach((linkEl, index) => {
		if (!(linkEl instanceof HTMLAnchorElement)) return;
		const entry = buildEntryFromAnchor(linkEl, 'Sidebar', index, order++);
		if (!entry) return;
		if (!allowedNames.has(entry.name.toLowerCase())) return;

		const key = `${entry.name.toLowerCase()}|${linkEl.getAttribute('href') ?? ''}`;
		if (seen.has(key)) return;
		seen.add(key);
		entries.push(entry);
	});

	debugLogSidebarEntries(entries);
	return entries;
}

function getAllowedEntryNames() {
	const allowed = new Set(['shop', 'bank']);
	const skills = game?.skills?.allObjects;

	if (!skills) return allowed;

	Array.from(skills).forEach((skill) => {
		const name = String(skill?.name ?? '').trim().toLowerCase();
		if (name) allowed.add(name);
	});

	return allowed;
}

function debugLogSidebarEntries(entries) {
	if (!Array.isArray(entries)) return;

	console.group(`SkillSearch: Indexed ${entries.length} sidebar items`);
	entries.forEach((entry, index) => {
		console.log(`${index + 1}. ${entry.name} -> ${entry.href || '(no href)'}`);
	});
	console.groupEnd();
}

function findMatchingEntries(query) {
	const normalized = query.trim().toLowerCase();
	const entries = getAllSidebarEntries();

	if (!normalized) {
		return entries;
	}

	const indexed = entries
		.map((entry, index) => ({ entry, index }))
		.filter(({ entry }) => entry.searchText.includes(normalized));

	indexed.sort((a, b) => {
		const aName = a.entry.name.toLowerCase();
		const bName = b.entry.name.toLowerCase();
		const aPos = aName.indexOf(normalized);
		const bPos = bName.indexOf(normalized);

		const aStarts = aPos === 0 ? 0 : 1;
		const bStarts = bPos === 0 ? 0 : 1;
		if (aStarts !== bStarts) return aStarts - bStarts;

		if (aPos !== bPos) return aPos - bPos;

		const aLenDelta = aName.length - normalized.length;
		const bLenDelta = bName.length - normalized.length;
		if (aLenDelta !== bLenDelta) return aLenDelta - bLenDelta;

		return a.index - b.index;
	});

	return indexed.map(({ entry }) => entry);
}

function navigateToEntry(entry) {
	if (!entry) return;

	if (typeof entry.navigate === 'function') {
		entry.navigate();
		return;
	}

	console.info(`SkillSearch: matched "${entry.name}" but could not auto-navigate in this client build.`);
}

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
