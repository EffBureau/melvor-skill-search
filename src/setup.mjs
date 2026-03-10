export async function setup({ loadModule }) {
	const main = await loadModule('src/main.mjs');

	main.init();
}
