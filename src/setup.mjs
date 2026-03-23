/**
 * Initializes the mod by loading feature modules and wiring dependencies.
 *
 * @param {{loadModule: (path: string) => Promise<any>, settings?: any}} context Toolkit setup context.
 * @returns {Promise<void>}
 */
export async function setup({ loadModule, settings }) {
	const popup = await loadModule('src/search-popup.mjs');
	const sidebarSearch = await loadModule('src/sidebar-search.mjs');
	const recentSearches = await loadModule('src/recent-searches.mjs');
	const hotkeySettings = await loadModule('src/hotkey-settings.mjs');
	const main = await loadModule('src/main.mjs');

	hotkeySettings.registerHotkeySettings?.(settings);

	const dependencies = {
		findMatchingEntries: sidebarSearch.findMatchingEntries,
		getAllSidebarEntries: sidebarSearch.getAllSidebarEntries,
		navigateToEntry: sidebarSearch.navigateToEntry,
		addRecentEntry: recentSearches.addRecentEntry,
		getRecentEntries: recentSearches.getRecentEntries,
	};

	const openSkillSearchPopup = () => popup.openSkillSearchPopup(dependencies);

	main.init({
		openSkillSearchPopup,
		isSearchHotkey: hotkeySettings.isSearchHotkey,
	});
}
