// Builds searchable entries from the Melvor sidebar and ranks results.

/**
 * @typedef {object} SidebarEntry
 * @property {string} id Unique entry identifier.
 * @property {string} name Display name.
 * @property {string} href Entry href attribute when available.
 * @property {string} searchText Normalized searchable label.
 * @property {number} order Indexed order in source.
 * @property {unknown} [icon] Optional icon metadata.
 * @property {() => void} navigate Navigation callback.
 */

// Whitelist: only skills + Shop + Bank should appear in search results.
function getAllowedEntryNames() {
	const allowed = new Set(['shop', 'bank']);
	const gameApi = typeof game !== 'undefined' ? game : globalThis.game;
	const skills = gameApi?.skills?.allObjects;

	if (!skills) return allowed;

	Array.from(skills).forEach((skill) => {
		const name = String(skill?.name ?? '').trim().toLowerCase();
		if (name) allowed.add(name);
	});

	return allowed;
}

// Reads icon info from a sidebar link (either image-based or class-based icon).
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

// Extracts the visible entry name from a sidebar anchor.
function getAnchorDisplayName(linkEl) {
	if (!(linkEl instanceof HTMLElement)) return '';

	const named = linkEl.querySelector('.nav-main-link-name, .name, .font-w600');
	if (named instanceof HTMLElement && named.textContent) {
		return named.textContent.trim();
	}

	return linkEl.textContent?.trim() ?? '';
}

// Converts one sidebar anchor element into a searchable/navigable entry object.
function buildEntryFromAnchor(linkEl, categoryName, index, order) {
	if (!(linkEl instanceof HTMLAnchorElement)) return null;

	const name = getAnchorDisplayName(linkEl);
	if (!name || name === 'Skill Search') return null;

	const href = linkEl.getAttribute('href') ?? '';
	const id = `${categoryName}:${name}:${href}:${index}`;

	return {
		id,
		name,
		href,
		searchText: name.toLowerCase(),
		order,
		icon: extractIconData(linkEl),
		navigate: () => {
			linkEl.click();
		},
	};
}

function pushEntryIfAllowed({ linkEl, categoryName, index, orderRef, allowedNames, seen, entries }) {
	if (!(linkEl instanceof HTMLAnchorElement)) return;

	const entry = buildEntryFromAnchor(linkEl, categoryName, index, orderRef.value++);
	if (!entry) return;
	if (!allowedNames.has(entry.name.toLowerCase())) return;

	const key = `${entry.name.toLowerCase()}|${linkEl.getAttribute('href') ?? ''}`;
	if (seen.has(key)) return;

	seen.add(key);
	entries.push(entry);
}

function createAliasEntry({ name, baseEntry, order }) {
	if (!baseEntry) return null;

	return {
		id: `alias:${name.toLowerCase()}`,
		name,
		href: baseEntry.href,
		searchText: name.toLowerCase(),
		order,
		icon: baseEntry.icon,
		navigate: baseEntry.navigate,
	};
}

function normalizeSpecialEntryNavigation(entries) {
	if (!Array.isArray(entries) || entries.length === 0) return entries;

	const attackEntry = entries.find((entry) => entry.name?.toLowerCase() === 'attack');
	if (!attackEntry || typeof attackEntry.navigate !== 'function') return entries;

	const specialNames = new Set(['combat', 'slayer', 'prayer']);
	entries.forEach((entry) => {
		if (!entry || typeof entry.name !== 'string') return;
		if (!specialNames.has(entry.name.toLowerCase())) return;
		entry.navigate = attackEntry.navigate;
	});

	const hasCombat = entries.some((entry) => entry.name?.toLowerCase() === 'combat');
	if (!hasCombat) {
		const combatAlias = createAliasEntry({
			name: 'Combat',
			baseEntry: attackEntry,
			order: entries.length,
		});
		if (combatAlias) {
			entries.push(combatAlias);
		}
	}

	return entries;
}

/**
 * Scans sidebar sources and returns searchable entries.
 *
 * @returns {SidebarEntry[]}
 */
export function getAllSidebarEntries() {
	const seen = new Set();
	const entries = [];
	const orderRef = { value: 0 };
	const allowedNames = getAllowedEntryNames();

	// Primary source: current rendered order from the actual sidebar DOM.
	const orderedAnchors = document.querySelectorAll('#sidebar .nav-main a, .sidebar .nav-main a, .nav-main a');
	if (orderedAnchors.length > 0) {
		Array.from(orderedAnchors).forEach((linkEl, index) => {
			pushEntryIfAllowed({
				linkEl,
				categoryName: 'Sidebar',
				index,
				orderRef,
				allowedNames,
				seen,
				entries,
			});
		});
	}

	if (entries.length > 0) return normalizeSpecialEntryNavigation(entries);

	// Fallback source: Sidebar API categories/items if DOM query did not produce results.
	const sidebarApi = typeof sidebar !== 'undefined' ? sidebar : globalThis.sidebar;
	if (typeof sidebarApi?.categories === 'function') {
		const categories = sidebarApi.categories();
		categories.forEach((category) => {
			const categoryName = String(category?.id ?? 'General').trim();
			const anchors = category?.rootEl?.querySelectorAll('a');
			if (!anchors) return;

			Array.from(anchors).forEach((linkEl, index) => {
				pushEntryIfAllowed({
					linkEl,
					categoryName,
					index,
					orderRef,
					allowedNames,
					seen,
					entries,
				});
			});
		});
	}

	const fallbackAnchors = document.querySelectorAll('#sidebar a, .sidebar a, .nav-main a');
	Array.from(fallbackAnchors).forEach((linkEl, index) => {
		pushEntryIfAllowed({
			linkEl,
			categoryName: 'Sidebar',
			index,
			orderRef,
			allowedNames,
			seen,
			entries,
		});
	});

	return normalizeSpecialEntryNavigation(entries);
}

/**
 * Filters and ranks entries by relevance to a query string.
 *
 * @param {string} query User search query.
 * @returns {SidebarEntry[]}
 */
export function findMatchingEntries(query) {
	const normalized = query.trim().toLowerCase();
	const entries = getAllSidebarEntries();

	if (!normalized) return entries;

	const indexed = entries
		.map((entry, index) => ({ entry, index }))
		.filter(({ entry }) => entry.searchText.includes(normalized));

	// Ranking strategy:
	// 1) prefix matches first ("min" -> "Mining")
	// 2) earlier match position in the name
	// 3) shorter extra length from the query
	// 4) original sidebar order as tie-breaker
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

/**
 * Navigates to the provided sidebar entry.
 *
 * @param {SidebarEntry | null | undefined} entry Target entry.
 * @returns {void}
 */
export function navigateToEntry(entry) {
	if (!entry) return;

	if (typeof entry.navigate === 'function') {
		entry.navigate();
	}
}
