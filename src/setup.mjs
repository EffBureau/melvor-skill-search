/**
 * Initializes the mod by loading feature modules and wiring dependencies.
 *
 * @param {{loadModule: (path: string) => Promise<any>, settings?: any}} context Toolkit setup context.
 * @returns {Promise<void>}
 */
export async function setup(context) {
	const { loadModule } = context;
	const popup = await loadModule('src/search-popup.mjs');
	const sidebarSearch = await loadModule('src/sidebar-search.mjs');
	const recentSearches = await loadModule('src/recent-searches.mjs');
	const hotkeySettings = await loadModule('src/hotkey-settings.mjs');
	const main = await loadModule('src/main.mjs');

	// Settings are not registered through official Mod Settings API;
	// hotkey configuration is accessed via the search popup gear icon instead.

	const dependencies = {
		findMatchingEntries: sidebarSearch.findMatchingEntries,
		getAllSidebarEntries: sidebarSearch.getAllSidebarEntries,
		navigateToEntry: sidebarSearch.navigateToEntry,
		addRecentEntry: recentSearches.addRecentEntry,
		getRecentEntries: recentSearches.getRecentEntries,
	};

	const openSkillSearchPopup = () => popup.openSkillSearchPopup({
		...dependencies,
		openHotkeySettingsPopup: hotkeySettings.openHotkeySettingsPopup,
		getSearchHotkey: hotkeySettings.getSearchHotkey,
		onSearchHotkeyChanged: hotkeySettings.onSearchHotkeyChanged,
	});
	const initMain = () => main.init({
		openSkillSearchPopup,
		isSearchHotkey: hotkeySettings.isSearchHotkey,
		getSearchHotkey: hotkeySettings.getSearchHotkey,
		onSearchHotkeyChanged: hotkeySettings.onSearchHotkeyChanged,
	});

	if (typeof context.onCharacterLoaded === 'function') {
		context.onCharacterLoaded(() => {
			initMain();
		});
		return;
	}

	// Fallback for runtimes that do not expose lifecycle hooks on the context.
	initMain();
}
