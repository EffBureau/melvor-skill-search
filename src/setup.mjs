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
	const interop = await loadModule('src/mod-interop.mjs');
	const main = await loadModule('src/main.mjs');

	interop.registerCombatSimulatorNamespace?.(context);
	if (typeof context.onInterfaceAvailable === 'function') {
		context.onInterfaceAvailable(() => {
			interop.registerCombatSimulatorNamespace?.(context);
			interop.logCombatSimulatorRegistrationState?.();
		});
	}

	const hasOfficialSettings = hotkeySettings.registerHotkeySettings?.(context) === true;
	if (!hasOfficialSettings) {
		console.warn('SkillSearch: Mod Settings API unavailable, using sidebar fallback.');
	}

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
		openHotkeySettingsPopup: hotkeySettings.openHotkeySettingsPopup,
		hasOfficialSettings,
	});
}
